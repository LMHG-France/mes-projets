import { useMemo } from 'react';
import { Package, Truck, MapPin, Home, Clock, CheckCircle, ExternalLink } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';

const STATUS_CONFIG = {
  pending:   { label: 'En transit',         color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   dot: 'bg-blue-500' },
  available: { label: 'Disponible au relais',color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200', dot: 'bg-indigo-500' },
  delivered: { label: 'Livré',               color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  dot: 'bg-green-500' },
  collected: { label: 'Récupéré',            color: 'text-gray-500',   bg: 'bg-gray-50',    border: 'border-gray-200',   dot: 'bg-gray-400' },
};

export function StockManager() {
  const { orders, loading } = useOrders();

  // Toutes les commandes sauf "collected", triées par date décroissante
  const pendingOrders = useMemo(() =>
    orders
      .filter(o => o.delivery_status !== 'collected')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders]
  );

  const totalItems = useMemo(() =>
    pendingOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0),
    [pendingOrders]
  );

  const totalValue = useMemo(() =>
    pendingOrders.reduce((sum, o) => sum + o.total_price, 0),
    [pendingOrders]
  );

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="py-8 px-4 lg:px-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Package size={32} className="text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Stock en attente</h1>
            <p className="text-gray-600 mt-1">Articles commandés en cours de livraison</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg"><Package className="text-blue-600" size={22} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Commandes actives</p>
              <p className="text-2xl font-bold text-gray-900">{pendingOrders.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-lg"><Truck className="text-green-600" size={22} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Unités en transit</p>
              <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-lg"><Clock className="text-orange-600" size={22} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Valeur totale</p>
              <p className="text-2xl font-bold text-gray-900">{totalValue.toFixed(2)} €</p>
            </div>
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : pendingOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
            <CheckCircle size={64} className="mx-auto mb-4 text-green-300" />
            <p className="text-lg font-medium">Tout est à jour !</p>
            <p className="text-sm mt-2">Aucune commande en attente de livraison</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingOrders.map(order => {
              const status = order.delivery_status ?? 'pending';
              const cfg    = STATUS_CONFIG[status];
              const deliveryDate = order.expected_delivery_date
                ? new Date(order.expected_delivery_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                : null;

              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Header commande */}
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <div>
                        <span className="font-semibold text-gray-900 text-sm">{order.supplier_name}</span>
                        <span className="ml-2 text-xs text-gray-400">{fmt(order.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {deliveryDate && (
                        <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                          <Clock size={12} />
                          {deliveryDate}
                        </span>
                      )}
                      {order.delivery_type === 'pickup'
                        ? <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-blue-200 text-blue-600 bg-blue-50"><MapPin size={11} /><span className="hidden sm:inline">Point relais</span></span>
                        : order.delivery_type === 'home'
                        ? <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 bg-gray-50"><Home size={11} /><span className="hidden sm:inline">Domicile</span></span>
                        : null
                      }
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                      {order.tracking_link && (
                        <a href={order.tracking_link} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                          <ExternalLink size={11} />
                          <span className="hidden sm:inline">Suivi</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Articles */}
                  <div className="divide-y divide-gray-50">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-5 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex-shrink-0 text-xs font-bold text-white bg-blue-500 rounded-full w-6 h-6 flex items-center justify-center">
                            {item.quantity}
                          </span>
                          <span className="text-sm text-gray-800 truncate">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-600 flex-shrink-0 ml-4">
                          {(item.quantity * (item.price_ttc ?? item.pricePerUnit)).toFixed(2)} €
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Footer total */}
                  <div className="flex justify-between items-center px-5 py-2.5 bg-gray-50 border-t border-gray-200">
                    <span className="text-xs text-gray-500">{order.items.length} article{order.items.length > 1 ? 's' : ''}</span>
                    <span className="text-sm font-bold text-blue-600">{order.total_price.toFixed(2)} €</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}