import { useMemo, useEffect, useState } from 'react';
import { Package, Truck, MapPin, Home, Clock, CheckCircle, ExternalLink, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Order } from '../hooks/useOrders';

const STATUS_CONFIG = {
  pending:   { label: 'En transit',  badge: 'bg-blue-500/10 text-blue-600 border-blue-200',    dot: '#3b82f6', pulse: true  },
  available: { label: 'Au relais',   badge: 'bg-violet-500/10 text-violet-600 border-violet-200', dot: '#8b5cf6', pulse: true  },
  delivered: { label: 'Livré',       badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', dot: '#10b981', pulse: false },
  collected: { label: 'Récupéré',   badge: 'bg-gray-100 text-gray-500 border-gray-200',        dot: '#9ca3af', pulse: false },
};

export function StockManager() {
  const { user } = useAuth();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setAllOrders(data || []); setLoading(false); });
    const channel = supabase.channel('stock_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') setAllOrders(prev => [payload.new as Order, ...prev]);
        if (payload.eventType === 'UPDATE') setAllOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as Order : o));
        if (payload.eventType === 'DELETE') setAllOrders(prev => prev.filter(o => o.id !== payload.old.id));
      }).subscribe();
    return () => { channel.unsubscribe(); };
  }, [user]);

  const pendingOrders = useMemo(() =>
    allOrders.filter(o => o.delivery_status !== 'collected')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [allOrders]);

  const totalItems = useMemo(() => pendingOrders.reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0), 0), [pendingOrders]);
  const totalValue = useMemo(() => pendingOrders.reduce((s, o) => s + o.total_price, 0), [pendingOrders]);

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const fmtFull = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const getDaysUntil = (s: string) => { const t = new Date(); t.setHours(0,0,0,0); const d = new Date(s); d.setHours(0,0,0,0); return Math.round((d.getTime()-t.getTime())/86400000); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Chargement du stock…</p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        .stock-page { font-family: 'DM Sans', sans-serif; }
        .mono { font-family: 'DM Mono', monospace; }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
        @keyframes pulse-ring { 0%{transform:scale(.8);opacity:.8} 100%{transform:scale(2.2);opacity:0} }
        @keyframes slide-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .order-card { animation: slide-in .3s ease both; }
        .order-card:nth-child(1){animation-delay:0ms}
        .order-card:nth-child(2){animation-delay:60ms}
        .order-card:nth-child(3){animation-delay:120ms}
        .order-card:nth-child(4){animation-delay:180ms}
        .order-card:nth-child(5){animation-delay:240ms}
        .pdot { animation: pulse-dot 2s ease-in-out infinite; }
        .pring { position:absolute;inset:-4px;border-radius:50%;animation:pulse-ring 2s ease-out infinite; }
        .stat-card { transition: transform .2s ease, box-shadow .2s ease; }
        .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.08); }
        .item-row { transition: background .12s ease; }
        .item-row:hover { background:#f8fafc; }
        .track-btn { transition: transform .15s ease; }
        .track-btn:hover { transform: translateX(2px); }
        .arrow-icon { transition: transform .2s ease; }
        .arrow-icon.open { transform: rotate(90deg); }
      `}</style>

      <div className="stock-page py-8 px-4 lg:px-8 min-h-screen" style={{ background: 'linear-gradient(160deg,#f0f4ff 0%,#f8fafc 50%,#f0fdf4 100%)' }}>
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-10">
            <span className="text-xs font-semibold tracking-widest text-blue-400 uppercase mono">Inventaire</span>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight mt-1">Stock en attente</h1>
            <p className="text-gray-500 mt-1.5 text-sm">Commandes en cours de livraison vers votre stock</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { label:'Commandes', value: String(pendingOrders.length), unit:'', color:'#3b82f6', bar:'from-blue-500 to-cyan-400', icon:<Package size={17} style={{color:'#3b82f6'}} /> },
              { label:'Unités',    value: String(totalItems),           unit:'', color:'#10b981', bar:'from-emerald-500 to-teal-400', icon:<Truck size={17} style={{color:'#10b981'}} /> },
              { label:'Valeur',    value: totalValue.toFixed(2),        unit:'€', color:'#f59e0b', bar:'from-amber-400 to-orange-400', icon:<span style={{color:'#f59e0b',fontWeight:700,fontSize:15}}>€</span> },
            ].map((s,i) => (
              <div key={i} className="stat-card bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400 font-medium tracking-wide uppercase">{s.label}</span>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:`${s.color}18`}}>{s.icon}</div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900 mono">{s.value}</span>
                  {s.unit && <span className="text-lg font-semibold text-gray-400 ml-0.5">{s.unit}</span>}
                </div>
                <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${s.bar} opacity-40`} />
              </div>
            ))}
          </div>

          {/* Empty */}
          {pendingOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={40} className="text-emerald-400" />
              </div>
              <p className="text-xl font-semibold text-gray-800">Tout est à jour !</p>
              <p className="text-sm text-gray-400 mt-2">Aucune commande en attente de livraison</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => {
                const status   = (order.delivery_status ?? 'pending') as keyof typeof STATUS_CONFIG;
                const cfg      = STATUS_CONFIG[status];
                const isOpen   = expanded[order.id] ?? true;
                const daysLeft = order.expected_delivery_date ? getDaysUntil(order.expected_delivery_date) : null;
                const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

                const urgencyLabel = daysLeft === null ? null
                  : daysLeft < 0  ? `${Math.abs(daysLeft)}j de retard`
                  : daysLeft === 0 ? "Aujourd'hui"
                  : daysLeft === 1 ? 'Demain'
                  : `Dans ${daysLeft}j`;
                const urgencyColor = daysLeft === null ? '' : daysLeft < 0 ? 'text-red-500' : daysLeft <= 1 ? 'text-blue-600 font-semibold' : 'text-gray-400';

                return (
                  <div key={order.id} className="order-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                    {/* Card header */}
                    <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none" style={{borderLeft:`3px solid ${cfg.dot}`}} onClick={() => toggleExpand(order.id)}>
                      {/* Pulse dot */}
                      <div className="relative flex-shrink-0 w-3 h-3">
                        <div className="w-3 h-3 rounded-full pdot" style={{background:cfg.dot}} />
                        {cfg.pulse && <div className="pring border-2" style={{borderColor:cfg.dot}} />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{order.supplier_name}</span>
                          <span className="text-xs text-gray-400 mono">{fmtFull(order.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-400">{totalQty} unité{totalQty>1?'s':''} · {order.items.length} article{order.items.length>1?'s':''}</span>
                          {urgencyLabel && <span className={`text-xs ${urgencyColor}`}>{urgencyLabel}</span>}
                        </div>
                      </div>

                      {/* Right badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {order.expected_delivery_date && (
                          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                            <Clock size={11} className="text-gray-400" />
                            <span className="text-xs text-gray-600 mono">{fmtDate(order.expected_delivery_date)}</span>
                          </div>
                        )}
                        {order.delivery_type === 'pickup' ? (
                          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border bg-violet-50 border-violet-200">
                            <MapPin size={11} className="text-violet-500" /><span className="text-xs text-violet-600 hidden sm:inline">Relais</span>
                          </div>
                        ) : order.delivery_type === 'home' ? (
                          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border bg-gray-50 border-gray-200">
                            <Home size={11} className="text-gray-500" /><span className="text-xs text-gray-500 hidden sm:inline">Domicile</span>
                          </div>
                        ) : null}
                        <span className={`text-xs px-3 py-1.5 rounded-xl border font-medium ${cfg.badge}`}>{cfg.label}</span>
                        {order.tracking_link && (
                          <a href={order.tracking_link} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                            className="track-btn flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
                            <ExternalLink size={11} /><span className="hidden sm:inline">Suivi</span>
                          </a>
                        )}
                        <ArrowRight size={16} className={`arrow-icon text-gray-300 ml-1 ${isOpen?'open':''}`} />
                      </div>
                    </div>

                    {/* Items */}
                    {isOpen && (
                      <div className="border-t border-gray-50">
                        {order.items.map((item, idx) => {
                          const lineTotal = (item.quantity * (item.price_ttc ?? item.pricePerUnit)).toFixed(2);
                          return (
                            <div key={idx} className="item-row flex items-center justify-between px-5 py-2.5 gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white mono"
                                  style={{background:`linear-gradient(135deg,${cfg.dot},${cfg.dot}99)`}}>
                                  {item.quantity}
                                </div>
                                <span className="text-sm text-gray-700 truncate">{item.name}</span>
                              </div>
                              <div className="flex items-center gap-4 flex-shrink-0">
                                {item.quantity > 1 && (
                                  <span className="text-xs text-gray-400 mono hidden sm:inline">
                                    {(item.price_ttc ?? item.pricePerUnit).toFixed(2)} € × {item.quantity}
                                  </span>
                                )}
                                <span className="text-sm font-semibold text-gray-900 mono w-20 text-right">{lineTotal} €</span>
                              </div>
                            </div>
                          );
                        })}
                        {/* Total */}
                        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50" style={{background:`${cfg.dot}08`}}>
                          <span className="text-xs text-gray-400 font-medium">Total commande</span>
                          <span className="text-base font-bold mono" style={{color:cfg.dot}}>{order.total_price.toFixed(2)} €</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}