import { useMemo, useEffect, useState } from 'react';
import { Package, Truck, MapPin, Home, Clock, ExternalLink, CheckCircle, ChevronRight, Box } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Order } from '../hooks/useOrders';

const STATUS = {
  pending:   { label: 'En transit',  color: '#3b82f6', bg: '#eff6ff', pulse: true  },
  available: { label: 'Au relais',   color: '#8b5cf6', bg: '#f5f3ff', pulse: true  },
  delivered: { label: 'Livré',       color: '#10b981', bg: '#ecfdf5', pulse: false },
  collected: { label: 'Récupéré',    color: '#9ca3af', bg: '#f9fafb', pulse: false },
};

export function StockManager() {
  const { user } = useAuth();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => {
        const orders = data || [];
        setAllOrders(orders);
        setLoading(false);
        if (orders.length > 0) setSelected(orders[0].id);
      });
    const ch = supabase.channel('stock_v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, (p) => {
        if (p.eventType === 'INSERT') setAllOrders(prev => [p.new as Order, ...prev]);
        if (p.eventType === 'UPDATE') setAllOrders(prev => prev.map(o => o.id === p.new.id ? p.new as Order : o));
        if (p.eventType === 'DELETE') setAllOrders(prev => prev.filter(o => o.id !== p.old.id));
      }).subscribe();
    return () => { ch.unsubscribe(); };
  }, [user]);

  const pending = useMemo(() =>
    allOrders.filter(o => o.delivery_status !== 'collected')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [allOrders]);

  const totalUnits = useMemo(() => pending.reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0), 0), [pending]);
  const totalValue = useMemo(() => pending.reduce((s, o) => s + o.total_price, 0), [pending]);

  const selectedOrder = pending.find(o => o.id === selected) ?? pending[0] ?? null;

  const fmtShort = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const fmtLong  = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const daysLeft = (d: string) => { const t = new Date(); t.setHours(0,0,0,0); const x = new Date(d); x.setHours(0,0,0,0); return Math.round((x.getTime()-t.getTime())/86400000); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .sm-page * { box-sizing: border-box; }
        .sm-page { font-family: 'Inter', sans-serif; }
        .jb { font-family: 'JetBrains Mono', monospace; }
        @keyframes pdot { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes pring { 0%{transform:scale(.9);opacity:.6} 100%{transform:scale(2.4);opacity:0} }
        @keyframes fadein { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes listIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .dot-pulse { animation: pdot 2s ease-in-out infinite; }
        .ring-pulse { position:absolute;inset:-5px;border-radius:50%;animation:pring 2s ease-out infinite; }
        .detail-panel { animation: fadein .25s ease; }
        .order-row { transition: all .15s ease; border-radius:10px; }
        .order-row:hover { background: #f1f5f9; }
        .order-row.active { background: white; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
        .item-line { transition: background .1s; border-radius: 8px; }
        .item-line:hover { background: #f8fafc; }
        .list-item { animation: listIn .2s ease both; }
        .list-item:nth-child(1){animation-delay:0ms}
        .list-item:nth-child(2){animation-delay:40ms}
        .list-item:nth-child(3){animation-delay:80ms}
        .list-item:nth-child(4){animation-delay:120ms}
        .list-item:nth-child(5){animation-delay:160ms}
        .list-item:nth-child(6){animation-delay:200ms}
      `}</style>

      <div className="sm-page min-h-screen" style={{background:'#f4f6fb'}}>
        <div className="max-w-6xl mx-auto px-4 py-8">

          {/* ── Top bar ── */}
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase jb mb-1">Inventaire</p>
            <h1 className="text-3xl font-bold text-gray-900">Stock en attente</h1>
          </div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Valeur totale',        val: `${totalValue.toFixed(2)} €`, icon: '€', iconBg: '#eff6ff', iconColor: '#3b82f6', bar: '#3b82f6' },
              { label: 'Unités totales',        val: String(totalUnits),           icon: '📦', iconBg: '#ecfdf5', iconColor: '#10b981', bar: '#10b981' },
              { label: 'Nombre de commandes',   val: String(pending.length),       icon: '🛒', iconBg: '#fff7ed', iconColor: '#f59e0b', bar: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background: s.iconBg}}>
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium truncate">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900 jb mt-0.5">{s.val}</p>
                </div>
              </div>
            ))}
          </div>

          {pending.length === 0 ? (
            <div className="bg-white rounded-2xl p-20 text-center shadow-sm">
              <CheckCircle size={48} className="text-emerald-300 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-700">Tout est à jour !</p>
              <p className="text-sm text-gray-400 mt-1">Aucune commande en cours</p>
            </div>
          ) : (
            <div className="flex gap-4 items-start">

              {/* ── LEFT: order list ── */}
              <div className="w-72 flex-shrink-0 bg-white rounded-2xl shadow-sm p-2 flex flex-col gap-1">
                {pending.map((order, idx) => {
                  const st  = (order.delivery_status ?? 'pending') as keyof typeof STATUS;
                  const cfg = STATUS[st];
                  const qty = order.items.reduce((s,i) => s + i.quantity, 0);
                  const dl  = order.expected_delivery_date ? daysLeft(order.expected_delivery_date) : null;
                  const isActive = order.id === (selectedOrder?.id);

                  return (
                    <div key={order.id} className={`list-item order-row px-3 py-3 cursor-pointer ${isActive ? 'active' : ''}`}
                      onClick={() => setSelected(order.id)}>
                      <div className="flex items-center gap-2.5">
                        {/* dot */}
                        <div className="relative flex-shrink-0 w-2.5 h-2.5">
                          <div className="w-2.5 h-2.5 rounded-full dot-pulse" style={{background:cfg.color}} />
                          {cfg.pulse && <div className="ring-pulse border" style={{borderColor:cfg.color}} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{order.supplier_name}</p>
                            <ChevronRight size={14} className={`flex-shrink-0 transition-colors ${isActive ? 'text-blue-400' : 'text-gray-300'}`} />
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-xs text-gray-400">{qty} unités</p>
                            {dl !== null ? (
                              <p className={`text-xs jb font-medium ${dl < 0 ? 'text-red-400' : dl === 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                                {dl < 0 ? `${Math.abs(dl)}j retard` : dl === 0 ? "Auj." : `J-${dl}`}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-300">—</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* mini progress bar */}
                      <div className="mt-2 h-0.5 rounded-full overflow-hidden bg-gray-100">
                        <div className="h-full rounded-full" style={{background:cfg.color, width: st === 'delivered' ? '100%' : st === 'available' ? '75%' : '40%', transition:'width .3s ease'}} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── RIGHT: detail panel ── */}
              {selectedOrder && (() => {
                const st  = (selectedOrder.delivery_status ?? 'pending') as keyof typeof STATUS;
                const cfg = STATUS[st];
                const qty = selectedOrder.items.reduce((s,i) => s + i.quantity, 0);
                const dl  = selectedOrder.expected_delivery_date ? daysLeft(selectedOrder.expected_delivery_date) : null;

                return (
                  <div key={selectedOrder.id} className="flex-1 detail-panel space-y-3">

                    {/* Header card */}
                    <div className="bg-white rounded-2xl shadow-sm p-5" style={{borderTop:`3px solid ${cfg.color}`}}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">{selectedOrder.supplier_name}</h2>
                          <p className="text-sm text-gray-400 mt-0.5">Commandé le {fmtLong(selectedOrder.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedOrder.delivery_type === 'pickup'
                            ? <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border" style={{color:'#8b5cf6',borderColor:'#ddd6fe',background:'#f5f3ff'}}><MapPin size={11}/>Point relais</span>
                            : selectedOrder.delivery_type === 'home'
                            ? <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 bg-gray-50"><Home size={11}/>Domicile</span>
                            : null
                          }
                          <span className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{color:cfg.color, background:cfg.bg}}>
                            {cfg.label}
                          </span>
                          {selectedOrder.tracking_link && (
                            <a href={selectedOrder.tracking_link} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-80"
                              style={{background:cfg.color}}>
                              <ExternalLink size={11} />Suivi
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Info strip */}
                      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-50 flex-wrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Box size={14} className="text-gray-300" />
                          <span><strong className="text-gray-800">{qty}</strong> unités</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Package size={14} className="text-gray-300" />
                          <span><strong className="text-gray-800">{selectedOrder.items.length}</strong> articles</span>
                        </div>
                        {selectedOrder.expected_delivery_date && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-500">
                            <Clock size={14} className="text-gray-300" />
                            <span>Livraison <strong className={dl !== null && dl <= 0 ? 'text-emerald-600' : 'text-gray-800'}>
                              {dl === 0 ? "aujourd'hui" : dl === 1 ? 'demain' : fmtShort(selectedOrder.expected_delivery_date)}
                            </strong></span>
                          </div>
                        )}
                        <div className="ml-auto text-right">
                          <p className="text-xs text-gray-400">Total</p>
                          <p className="text-2xl font-bold jb" style={{color:cfg.color}}>{selectedOrder.total_price.toFixed(2)} €</p>
                        </div>
                      </div>
                    </div>

                    {/* Items card */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Articles</p>
                        <p className="text-xs text-gray-300 jb">{selectedOrder.items.length} lignes</p>
                      </div>
                      <div className="p-3 space-y-0.5">
                        {selectedOrder.items.map((item, idx) => {
                          const line = (item.quantity * (item.price_ttc ?? item.pricePerUnit)).toFixed(2);
                          const unit = (item.price_ttc ?? item.pricePerUnit).toFixed(2);
                          return (
                            <div key={idx} className="item-line flex items-center gap-3 px-3 py-2">
                              <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white jb"
                                style={{background:`linear-gradient(135deg,${cfg.color},${cfg.color}bb)`}}>
                                {item.quantity}
                              </div>
                              <span className="flex-1 text-sm text-gray-700 truncate min-w-0">{item.name}</span>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                {item.quantity > 1 && (
                                  <span className="text-xs text-gray-300 jb hidden sm:inline">{unit} ×{item.quantity}</span>
                                )}
                                <span className="text-sm font-semibold text-gray-800 jb w-16 text-right">{line} €</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </>
  );
}