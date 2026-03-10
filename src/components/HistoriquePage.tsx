import { useMemo, useState } from 'react';
import { Search, X, Package, Building2, Calendar, TrendingUp, ShoppingBag } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';

interface HistoryLine {
  productName: string;
  supplierName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  orderDate: string;
  orderId: string;
}

export function HistoriquePage() {
  const { orders, loading } = useOrders();
  const [search, setSearch] = useState('');

  // Aplatir tous les articles de toutes les commandes (y compris collected/hidden)
  const allLines = useMemo((): HistoryLine[] => {
    return orders.flatMap(order =>
      order.items.map(item => ({
        productName:  item.name,
        supplierName: order.supplier_name,
        quantity:     item.quantity,
        unitPrice:    item.price_ttc ?? item.pricePerUnit ?? 0,
        totalPrice:   item.quantity * (item.price_ttc ?? item.pricePerUnit ?? 0),
        orderDate:    order.created_at,
        orderId:      order.id,
      }))
    ).sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [orders]);

  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return allLines;
    return allLines.filter(l =>
      l.productName.toLowerCase().includes(q) ||
      l.supplierName.toLowerCase().includes(q)
    );
  }, [allLines, q]);

  // Stats sur les résultats filtrés
  const stats = useMemo(() => {
    const totalQty   = filtered.reduce((s, l) => s + l.quantity, 0);
    const totalValue = filtered.reduce((s, l) => s + l.totalPrice, 0);
    const suppliers  = new Set(filtered.map(l => l.supplierName)).size;
    const products   = new Set(filtered.map(l => l.productName.toLowerCase())).size;
    return { totalQty, totalValue, suppliers, products };
  }, [filtered]);

  // Grouper par fournisseur quand recherche fournisseur, sinon par produit
  const isSupplierSearch = q && filtered.length > 0 && filtered.every(l => l.supplierName.toLowerCase().includes(q)) && !filtered[0].productName.toLowerCase().includes(q);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtPrice = (p: number) => p.toFixed(2) + ' €';

  return (
    <div className="py-8 px-4 lg:px-8 min-h-screen" style={{ background: '#f4f6fb' }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Historique</h1>
          <p className="text-gray-500 mt-1 text-sm">Retrouvez tous vos achats par produit ou fournisseur</p>
        </div>

        {/* Barre de recherche */}
        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un produit ou un fournisseur..."
            className="w-full pl-12 pr-12 py-3.5 text-sm bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Stats */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Références',  val: stats.products,               icon: Package,     color: '#3b82f6', bg: '#eff6ff' },
              { label: 'Fournisseurs',val: stats.suppliers,              icon: Building2,   color: '#8b5cf6', bg: '#f5f3ff' },
              { label: 'Unités',      val: stats.totalQty,               icon: ShoppingBag, color: '#10b981', bg: '#ecfdf5' },
              { label: 'Valeur',      val: fmtPrice(stats.totalValue),   icon: TrendingUp,  color: '#f59e0b', bg: '#fffbeb' },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                    <Icon size={16} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{s.label}</p>
                    <p className="text-base font-bold text-gray-900">{s.val}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Contenu */}
        {loading ? (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : !q ? (
          /* État initial — pas encore de recherche */
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={28} className="text-blue-400" />
            </div>
            <p className="text-lg font-semibold text-gray-700">Tapez pour rechercher</p>
            <p className="text-sm text-gray-400 mt-1">
              Recherchez par nom de produit ou par fournisseur<br />
              <span className="text-blue-400 font-medium">{allLines.length} articles</span> dans l'historique
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
            <p className="text-gray-500">Aucun résultat pour "<strong>{search}</strong>"</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Header tableau */}
            <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <div className="col-span-5">Produit</div>
              <div className="col-span-3">Fournisseur</div>
              <div className="col-span-1 text-center">Qté</div>
              <div className="col-span-1 text-right">Prix/u</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1 text-right">Date</div>
            </div>

            {/* Lignes */}
            <div className="divide-y divide-gray-50">
              {filtered.map((line, idx) => {
                const highlight = (text: string) => {
                  if (!q) return text;
                  const idx = text.toLowerCase().indexOf(q);
                  if (idx === -1) return text;
                  return (
                    <>
                      {text.slice(0, idx)}
                      <mark className="bg-yellow-100 text-yellow-800 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
                      {text.slice(idx + q.length)}
                    </>
                  );
                };

                return (
                  <div key={idx} className="grid grid-cols-12 px-5 py-3 hover:bg-gray-50 transition-colors items-center">
                    <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                      <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Package size={11} className="text-blue-500" />
                      </div>
                      <span className="text-sm text-gray-800 truncate">{highlight(line.productName)}</span>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <span className="text-sm text-gray-500 truncate block">{highlight(line.supplierName)}</span>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="text-sm font-medium text-gray-700">{line.quantity}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-xs text-gray-400">{fmtPrice(line.unitPrice)}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-sm font-semibold text-blue-600">{fmtPrice(line.totalPrice)}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-xs text-gray-400 flex items-center justify-end gap-1">
                        <Calendar size={10} className="flex-shrink-0" />
                        {fmtDate(line.orderDate)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
              <span className="text-sm font-bold text-blue-600">{fmtPrice(stats.totalValue)}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}