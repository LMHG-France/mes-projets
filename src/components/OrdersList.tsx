import { useState, useMemo } from 'react';
import { ExternalLink, Trash2, Edit2, Package, Eye, X, Search, Filter, Copy } from 'lucide-react';
import { Order } from '../hooks/useOrders';

interface OrdersListProps {
  orders: Order[];
  onEdit: (order: Order) => void;
  onDelete: (orderId: string) => Promise<void>;
  onDuplicate: (order: Order, times: number) => Promise<void>;
  isLoading?: boolean;
  onFilteredOrdersChange?: (filtered: Order[]) => void;
}

export function OrdersList({ orders, onEdit, onDelete, onDuplicate, isLoading, onFilteredOrdersChange }: OrdersListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [duplicateOrder, setDuplicateOrder] = useState<Order | null>(null);
  const [duplicateTimes, setDuplicateTimes] = useState(2);
  const [duplicating, setDuplicating] = useState(false);
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'supplier'>('date');

  const handleDelete = async (orderId: string) => {
    try {
      setDeletingId(orderId);
      await onDelete(orderId);
    } catch (error) {
      alert('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const filteredAndSortedOrders = useMemo(() => {
    let filtered = orders;

    // Filtrer par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.supplier_name.toLowerCase().includes(query) ||
        order.items.some(item => item.name.toLowerCase().includes(query)) ||
        order.total_price.toString().includes(query)
      );
    }

    // Filtrer par date
    if (filterDate !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());

        switch (filterDate) {
          case 'today':
            return orderDay.getTime() === today.getTime();
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return orderDay >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return orderDay >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Trier
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'price':
          return b.total_price - a.total_price;
        case 'supplier':
          return a.supplier_name.localeCompare(b.supplier_name);
        default:
          return 0;
      }
    });

    // Notifier le parent des commandes filtrées
    if (onFilteredOrdersChange) {
      onFilteredOrdersChange(sorted);
    }

    return sorted;
  }, [orders, searchQuery, filterDate, sortBy, onFilteredOrdersChange]);

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg">Aucune commande pour le moment</p>
        <p className="text-gray-400 text-sm">Commencez en cliquant sur "Ajouter une commande"</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 space-y-4">
        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Rechercher par fournisseur, produit ou prix..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Période:</span>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value as any)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Toutes</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">7 derniers jours</option>
              <option value="month">30 derniers jours</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Trier par:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Date (récent)</option>
              <option value="price">Prix (élevé)</option>
              <option value="supplier">Fournisseur (A-Z)</option>
            </select>
          </div>

          {(searchQuery || filterDate !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterDate('all');
              }}
              className="ml-auto px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Réinitialiser
            </button>
          )}
        </div>

        {/* Résultats */}
        <div className="text-sm text-gray-600">
          {filteredAndSortedOrders.length} commande{filteredAndSortedOrders.length !== 1 ? 's' : ''} trouvée{filteredAndSortedOrders.length !== 1 ? 's' : ''}
        </div>
      </div>

      {filteredAndSortedOrders.length === 0 ? (
        <div className="text-center py-12">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">Aucune commande trouvée</p>
          <p className="text-gray-400 text-sm">Essayez de modifier vos critères de recherche</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedOrders.map((order) => (
          <div
            key={order.id}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow flex flex-col aspect-square"
          >
            <div className="flex-1 flex flex-col p-4">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900 truncate">
                  {order.supplier_name}
                </h3>
                <p className="text-xs text-gray-500">
                  {formatDate(order.created_at)}
                </p>
              </div>

              <div className="mb-3">
                <p className="text-2xl font-bold text-blue-600">
                  {order.total_price.toFixed(2)} €
                </p>
                <p className="text-xs text-gray-500">
                  {order.items.length} article{order.items.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="flex-1 mb-3 overflow-hidden">
                <div className="space-y-1">
                  {order.items.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="text-xs text-gray-600 truncate">
                      {item.quantity}x {item.name}
                    </div>
                  ))}
                  {order.items.length > 2 && (
                    <div className="text-xs text-gray-400">
                      +{order.items.length - 2} autre{order.items.length - 2 !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="flex items-center justify-center gap-1 px-2 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Eye size={14} />
                  Détails
                </button>
                <button
                  onClick={() => onEdit(order)}
                  className="flex items-center justify-center gap-1 px-2 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  disabled={isLoading || deletingId === order.id}
                >
                  <Edit2 size={14} />
                  Modifier
                </button>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 rounded-t-2xl overflow-hidden">
              <div className="p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Détails de la commande</h2>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {selectedOrder.supplier_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formatDate(selectedOrder.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">Prix total</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {selectedOrder.total_price.toFixed(2)} €
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3 font-medium">Articles:</p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 mb-2 border-b border-gray-200">
                    <div className="w-20">Quantité</div>
                    <div className="flex-1">Nom du produit</div>
                    <div className="w-32 text-right">Prix Unitaire TTC</div>
                  </div>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center text-sm">
                        <div className="w-20">
                          <span className="bg-white px-2 py-1 rounded text-xs font-medium text-gray-600">
                            {item.quantity}x
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="text-gray-800">{item.name}</div>
                          {item.price_ht && item.price_ttc && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              HT: {item.price_ht.toFixed(2)} € | TTC: {item.price_ttc.toFixed(2)} €
                            </div>
                          )}
                        </div>
                        <div className="w-32 text-right font-semibold text-gray-900">
                          {(item.price_ttc || item.pricePerUnit).toFixed(2)} €
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap items-center gap-4">
                {selectedOrder.tracking_link ? (
                  <a
                    href={selectedOrder.tracking_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-medium rounded-lg transition-colors"
                  >
                    <ExternalLink size={16} />
                    Suivre la commande
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-orange-50 border border-orange-200 text-orange-700">
                    ⚠️ Lien de suivi manquant
                  </span>
                )}
                <div className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg ${
                  selectedOrder.expected_delivery_date
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-gray-50 border border-gray-200 text-gray-500'
                }`}>
                  <Package size={16} />
                  <span>
                    {selectedOrder.expected_delivery_date
                      ? `Livraison prévue: ${new Date(selectedOrder.expected_delivery_date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}`
                      : 'Date de livraison non communiquée'
                    }
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => { setDuplicateOrder(selectedOrder); setDuplicateTimes(2); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                  disabled={isLoading || deletingId === selectedOrder.id}
                >
                  <Copy size={16} />
                  Dupliquer
                </button>
                <button
                  onClick={() => {
                    onEdit(selectedOrder);
                    setSelectedOrder(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  disabled={isLoading || deletingId === selectedOrder.id}
                >
                  <Edit2 size={16} />
                  Modifier
                </button>
                <button
                  onClick={async () => {
                    await handleDelete(selectedOrder.id);
                    setSelectedOrder(null);
                  }}
                  disabled={isLoading || deletingId === selectedOrder.id}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal duplication */}
      {duplicateOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Dupliquer la commande</h3>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-medium text-gray-700">{duplicateOrder.supplier_name}</span> — {duplicateOrder.total_price.toFixed(2)} €
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de copies</label>
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setDuplicateTimes(t => Math.max(1, t - 1))}
                className="w-9 h-9 rounded-xl border border-gray-200 text-gray-600 text-lg font-bold hover:bg-gray-50 flex items-center justify-center"
              >−</button>
              <span className="text-2xl font-bold text-gray-900 w-8 text-center">{duplicateTimes}</span>
              <button
                onClick={() => setDuplicateTimes(t => Math.min(20, t + 1))}
                className="w-9 h-9 rounded-xl border border-gray-200 text-gray-600 text-lg font-bold hover:bg-gray-50 flex items-center justify-center"
              >+</button>
              <span className="text-sm text-gray-400 ml-1">commande{duplicateTimes > 1 ? 's' : ''} créée{duplicateTimes > 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDuplicateOrder(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
              >Annuler</button>
              <button
                disabled={duplicating}
                onClick={async () => {
                  setDuplicating(true);
                  try {
                    await onDuplicate(duplicateOrder, duplicateTimes);
                    setDuplicateOrder(null);
                    setSelectedOrder(null);
                  } finally { setDuplicating(false); }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {duplicating ? 'Création...' : <><Copy size={14} /> Créer {duplicateTimes}x</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}