import { useMemo, useEffect, useState, useCallback } from 'react';
import { Package, Truck, MapPin, Home, Clock, ExternalLink, CheckCircle, ChevronRight, Box, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Order, useOrders } from '../hooks/useOrders';
import { useStock } from '../hooks/useStock';

const STATUS = {
  pending:   { label: 'En transit',  color: '#3b82f6', bg: '#eff6ff', pulse: true  },
  available: { label: 'Au relais',   color: '#8b5cf6', bg: '#f5f3ff', pulse: true  },
  delivered: { label: 'Livré',       color: '#10b981', bg: '#ecfdf5', pulse: false },
  collected: { label: 'Récupéré',    color: '#9ca3af', bg: '#f9fafb', pulse: false },
};

// ── Add stock item form ──────────────────────────────────────
function AddItemForm({ onAdd, onCancel }: { onAdd: (name: string, qty: number, price: number) => void; onCancel: () => void }) {
  const [name, setName]   = useState('');
  const [qty, setQty]     = useState('1');
  const [price, setPrice] = useState('');

  const handle = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), parseInt(qty) || 1, parseFloat(price) || 0);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Nouvel article</p>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du produit"
        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <div className="flex gap-2">
        <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qté" min="1"
          className="w-24 px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <input type="text" value={price} onChange={e => setPrice(e.target.value)} placeholder="Prix unitaire (€)"
          className="flex-1 px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>
      <div className="flex gap-2">
        <button onClick={handle} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Check size={14} /> Ajouter
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Inline edit row ──────────────────────────────────────────
function StockRow({ item, onUpdate, onDelete }: { item: any; onUpdate: (id: string, data: any) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty]         = useState(String(item.quantity));
  const [price, setPrice]     = useState(String(item.unit_price));

  const save = () => {
    onUpdate(item.id, { quantity: parseInt(qty) || 1, unit_price: parseFloat(price) || 0 });
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white jb bg-gradient-to-br from-blue-500 to-blue-400">
        {item.quantity}
      </div>
      <span className="flex-1 text-sm text-gray-700 truncate">{item.name}</span>
      {editing ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input type="number" value={qty} onChange={e => setQty(e.target.value)}
            className="w-14 px-2 py-1 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 jb" />
          <input type="text" value={price} onChange={e => setPrice(e.target.value)}
            className="w-20 px-2 py-1 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 jb" />
          <button onClick={save} className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"><Check size={12} /></button>
          <button onClick={() => setEditing(false)} className="p-1 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100 transition-colors"><X size={12} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-400 jb hidden sm:inline">{item.unit_price > 0 ? `${item.unit_price.toFixed(2)} €/u` : '—'}</span>
          <span className="text-sm font-semibold text-gray-900 jb w-16 text-right">
            {item.unit_price > 0 ? `${(item.quantity * item.unit_price).toFixed(2)} €` : '—'}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Modifier"><Edit2 size={13} /></button>
            <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Supprimer"><Trash2 size={13} /></button>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Import modal : choisir les produits à ajouter au stock ──
function ImportModal({ order, onImport, onClose }: {
  order: Order;
  onImport: (items: { name: string; quantity: number; unit_price: number }[]) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Record<number, boolean>>(
    Object.fromEntries(order.items.map((_, i) => [i, true]))
  );
  const [quantities, setQuantities] = useState<Record<number, number>>(
    Object.fromEntries(order.items.map((item, i) => [i, item.quantity]))
  );
  const [loading, setLoading] = useState(false);

  const toggleAll = (val: boolean) =>
    setSelected(Object.fromEntries(order.items.map((_, i) => [i, val])));

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleImport = async () => {
    setLoading(true);
    const toImport = order.items
      .filter((_, i) => selected[i])
      .map((item, i) => {
        const originalIdx = order.items.indexOf(item);
        return {
          name: item.name,
          quantity: quantities[originalIdx] || item.quantity,
          unit_price: item.price_ttc ?? item.pricePerUnit,
        };
      });
    await onImport(toImport);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.5)'}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{order.supplier_name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Sélectionnez les articles à ajouter au stock</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>

        {/* Select all bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-xs text-gray-500 font-medium">{selectedCount} / {order.items.length} articles sélectionnés</span>
          <div className="flex gap-2">
            <button onClick={() => toggleAll(true)} className="text-xs px-3 py-1 rounded-lg bg-blue-100 text-blue-600 font-medium hover:bg-blue-200 transition-colors">Tout sélectionner</button>
            <button onClick={() => toggleAll(false)} className="text-xs px-3 py-1 rounded-lg bg-gray-200 text-gray-500 font-medium hover:bg-gray-300 transition-colors">Aucun</button>
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {order.items.map((item, i) => {
            const unitPrice = item.price_ttc ?? item.pricePerUnit;
            const isSelected = selected[i];
            return (
              <div key={i}
                onClick={() => setSelected(prev => ({ ...prev, [i]: !prev[i] }))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                style={{background: isSelected ? '#eff6ff' : '#f9fafb', border: `1px solid ${isSelected ? '#bfdbfe' : '#f3f4f6'}`}}>
                {/* Checkbox */}
                <div className="flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                  style={{borderColor: isSelected ? '#3b82f6' : '#d1d5db', background: isSelected ? '#3b82f6' : 'white'}}>
                  {isSelected && <Check size={11} color="white" />}
                </div>
                {/* Quantity input */}
                <input
                  type="number"
                  value={quantities[i]}
                  min={1} max={item.quantity}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setQuantities(prev => ({ ...prev, [i]: Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1)) }))}
                  className="w-12 px-2 py-1 text-xs border border-gray-200 rounded-lg jb text-center focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                />
                {/* Name */}
                <span className="flex-1 text-sm text-gray-700 truncate">{item.name}</span>
                {/* Price */}
                <span className="text-xs text-gray-400 jb flex-shrink-0">{unitPrice.toFixed(2)} €/u</span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors">Annuler</button>
          <button onClick={handleImport} disabled={loading || selectedCount === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={15} />}
            Ajouter {selectedCount > 0 ? `${selectedCount} article${selectedCount > 1 ? 's' : ''}` : ''} au stock
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export function StockManager() {
  const { user } = useAuth();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selected, setSelected]   = useState<string | null>(null);
  const [tab, setTab]             = useState<'transit' | 'stock'>('transit');
  const [showAdd, setShowAdd]     = useState(false);
  const [importModalOrder, setImportModalOrder] = useState<Order | null>(null);

  const { deleteOrder } = useOrders();
  const { items: stockItems, loading: loadingStock, addItem, addFromOrder, updateItem, deleteItem, totalValue: stockValue, totalUnits: stockUnits } = useStock();
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<string | null>(null);

  const handleDeleteOrder = async (orderId: string) => {
    await deleteOrder(orderId);
    setAllOrders(prev => prev.filter(o => o.id !== orderId));
    setSelected(null);
    setConfirmDeleteOrder(null);
  };

  useEffect(() => {
    if (!user) return;
    setLoadingOrders(true);
    supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { const o = data || []; setAllOrders(o); setLoadingOrders(false); if (o.length) setSelected(o[0].id); });
    const ch = supabase.channel('stock_orders_v4')
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

  const transitUnits = useMemo(() => pending.reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0), 0), [pending]);
  const transitValue = useMemo(() => pending.reduce((s, o) => s + o.total_price, 0), [pending]);
  const selectedOrder = pending.find(o => o.id === selected) ?? pending[0] ?? null;

  const fmtShort = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const fmtLong  = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const daysLeft = (d: string) => { const t = new Date(); t.setHours(0,0,0,0); const x = new Date(d); x.setHours(0,0,0,0); return Math.round((x.getTime()-t.getTime())/86400000); };

  const handleImportItems = async (items: { name: string; quantity: number; unit_price: number }[]) => {
    for (const item of items) {
      await addItem({ name: item.name, quantity: item.quantity, unit_price: item.unit_price, source_order_id: importModalOrder?.id });
    }
    setTab('stock');
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .sm-page { font-family:'Inter',sans-serif; }
        .jb { font-family:'JetBrains Mono',monospace; }
        @keyframes pdot{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes pring{0%{transform:scale(.9);opacity:.6}100%{transform:scale(2.4);opacity:0}}
        @keyframes fadein{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:translateX(0)}}
        @keyframes listIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .dot-p{animation:pdot 2s ease-in-out infinite}
        .ring-p{position:absolute;inset:-5px;border-radius:50%;animation:pring 2s ease-out infinite}
        .detail-panel{animation:fadein .2s ease}
        .order-row{transition:all .15s ease;border-radius:10px}
        .order-row:hover{background:#f1f5f9}
        .order-row.active{background:white;box-shadow:0 1px 8px rgba(0,0,0,.08)}
        .stock-item{animation:slideUp .2s ease both}
      `}</style>

      <div className="sm-page min-h-screen" style={{background:'#f4f6fb'}}>
        <div className="max-w-6xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase jb mb-1">Inventaire</p>
            <h1 className="text-3xl font-bold text-gray-900">Stock en attente</h1>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label:'En transit',   val:`${transitValue.toFixed(2)} €`, sub:`${pending.length} commandes`,   icon:'🚚', iconBg:'#eff6ff', tab:'transit' as const },
              { label:'Unités transit', val:String(transitUnits),          sub:'unités commandées',              icon:'📦', iconBg:'#ecfdf5', tab:'transit' as const },
              { label:'Mon stock',    val:`${stockValue.toFixed(2)} €`,   sub:`${stockItems.length} références`,icon:'🏠', iconBg:'#f5f3ff', tab:'stock' as const },
              { label:'Unités stock', val:String(stockUnits),              sub:'unités disponibles',             icon:'✅', iconBg:'#fff7ed', tab:'stock' as const },
            ].map((s,i) => (
              <button key={i} onClick={() => setTab(s.tab)}
                className={`text-left bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-all ${tab === s.tab ? 'ring-2 ring-blue-400' : ''}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{background:s.iconBg}}>{s.icon}</div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium truncate">{s.label}</p>
                  <p className="text-lg font-bold text-gray-900 jb leading-tight">{s.val}</p>
                  <p className="text-xs text-gray-400">{s.sub}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 shadow-sm w-fit">
            <button onClick={() => setTab('transit')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'transit' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              🚚 En transit <span className="ml-1.5 text-xs opacity-70">{pending.length}</span>
            </button>
            <button onClick={() => setTab('stock')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'stock' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              🏠 Mon stock <span className="ml-1.5 text-xs opacity-70">{stockItems.length}</span>
            </button>
          </div>

          {/* ── TAB: EN TRANSIT ── */}
          {tab === 'transit' && (
            pending.length === 0 ? (
              <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
                <CheckCircle size={48} className="text-emerald-300 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-700">Aucune commande en cours</p>
              </div>
            ) : (
              <div className="flex gap-4 items-start">
                {/* Left list */}
                <div className="w-96 flex-shrink-0 bg-white rounded-2xl shadow-sm p-2 flex flex-col gap-1">
                  {pending.map((order) => {
                    const st  = (order.delivery_status ?? 'pending') as keyof typeof STATUS;
                    const cfg = STATUS[st];
                    const qty = order.items.reduce((s,i) => s + i.quantity, 0);
                    const dl  = order.expected_delivery_date ? daysLeft(order.expected_delivery_date) : null;
                    const isActive = order.id === (selectedOrder?.id);
                    return (
                      <div key={order.id} className={`order-row px-3 py-3 cursor-pointer ${isActive ? 'active' : ''}`} onClick={() => setSelected(order.id)}>
                        <div className="flex items-center gap-2.5">
                          <div className="relative flex-shrink-0 w-2.5 h-2.5">
                            <div className="w-2.5 h-2.5 rounded-full dot-p" style={{background:cfg.color}} />
                            {cfg.pulse && <div className="ring-p border" style={{borderColor:cfg.color}} />}
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
                                  {dl < 0 ? `${Math.abs(dl)}j retard` : dl === 0 ? 'Auj.' : `J-${dl}`}
                                </p>
                              ) : <p className="text-xs text-gray-300">—</p>}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 h-0.5 rounded-full overflow-hidden bg-gray-100">
                          <div className="h-full rounded-full transition-all" style={{background:cfg.color, width: st==='delivered'?'100%':st==='available'?'75%':'40%'}} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right detail */}
                {selectedOrder && (() => {
                  const st  = (selectedOrder.delivery_status ?? 'pending') as keyof typeof STATUS;
                  const cfg = STATUS[st];
                  const qty = selectedOrder.items.reduce((s,i) => s + i.quantity, 0);
                  const dl  = selectedOrder.expected_delivery_date ? daysLeft(selectedOrder.expected_delivery_date) : null;
                  return (
                    <div key={selectedOrder.id} className="flex-1 detail-panel space-y-3">
                      <div className="bg-white rounded-2xl shadow-sm p-5" style={{borderTop:`3px solid ${cfg.color}`}}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <h2 className="text-xl font-bold text-gray-900">{selectedOrder.supplier_name}</h2>
                            <p className="text-sm text-gray-400 mt-0.5">Commandé le {fmtLong(selectedOrder.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {selectedOrder.delivery_type==='pickup' ? <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border" style={{color:'#8b5cf6',borderColor:'#ddd6fe',background:'#f5f3ff'}}><MapPin size={11}/>Point relais</span>
                              : selectedOrder.delivery_type==='home' ? <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 bg-gray-50"><Home size={11}/>Domicile</span> : null}
                            <span className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{color:cfg.color,background:cfg.bg}}>{cfg.label}</span>
                            {selectedOrder.tracking_link && (
                              <a href={selectedOrder.tracking_link} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-white hover:opacity-80 transition-opacity" style={{background:cfg.color}}>
                                <ExternalLink size={11}/>Suivi
                              </a>
                            )}
                            {/* Import vers stock */}
                            <button onClick={() => setImportModalOrder(selectedOrder)}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors">
                              <Plus size={11}/>Ajouter au stock
                            </button>
                            <button onClick={() => setConfirmDeleteOrder(selectedOrder.id)}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                              <Trash2 size={11}/>Supprimer
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-50 flex-wrap">
                          <div className="flex items-center gap-1.5 text-sm text-gray-500"><Box size={14} className="text-gray-300"/><span><strong className="text-gray-800">{qty}</strong> unités</span></div>
                          <div className="flex items-center gap-1.5 text-sm text-gray-500"><Package size={14} className="text-gray-300"/><span><strong className="text-gray-800">{selectedOrder.items.length}</strong> articles</span></div>
                          {selectedOrder.expected_delivery_date && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-500">
                              <Clock size={14} className="text-gray-300"/>
                              <span>Livraison <strong className={dl!==null&&dl<=0?'text-emerald-600':'text-gray-800'}>
                                {dl===0?"aujourd'hui":dl===1?'demain':fmtShort(selectedOrder.expected_delivery_date)}
                              </strong></span>
                            </div>
                          )}
                          <div className="ml-auto text-right">
                            <p className="text-xs text-gray-400">Total</p>
                            <p className="text-2xl font-bold jb" style={{color:cfg.color}}>{selectedOrder.total_price.toFixed(2)} €</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Articles</p>
                          <p className="text-xs text-gray-300 jb">{selectedOrder.items.length} lignes</p>
                        </div>
                        <div className="p-3 space-y-0.5">
                          {selectedOrder.items.map((item, idx) => {
                            const line = (item.quantity*(item.price_ttc??item.pricePerUnit)).toFixed(2);
                            const unit = (item.price_ttc??item.pricePerUnit).toFixed(2);
                            return (
                              <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                                <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white jb" style={{background:`linear-gradient(135deg,${cfg.color},${cfg.color}bb)`}}>{item.quantity}</div>
                                <span className="flex-1 text-sm text-gray-700 truncate">{item.name}</span>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  {item.quantity>1&&<span className="text-xs text-gray-300 jb hidden sm:inline">{unit}×{item.quantity}</span>}
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
            )
          )}

          {/* ── TAB: MON STOCK ── */}
          {tab === 'stock' && (
            <div className="space-y-4">
              {/* Add form toggle */}
              {showAdd ? (
                <AddItemForm
                  onAdd={async (name, qty, price) => { await addItem({ name, quantity: qty, unit_price: price }); setShowAdd(false); }}
                  onCancel={() => setShowAdd(false)}
                />
              ) : (
                <button onClick={() => setShowAdd(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border-2 border-dashed border-blue-200 text-blue-500 text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-all w-full justify-center">
                  <Plus size={16} /> Ajouter un article manuellement
                </button>
              )}

              {/* Stock list */}
              {loadingStock ? (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                  <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : stockItems.length === 0 ? (
                <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
                  <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package size={32} className="text-purple-300" />
                  </div>
                  <p className="text-lg font-semibold text-gray-700">Stock vide</p>
                  <p className="text-sm text-gray-400 mt-1">Ajoutez des articles manuellement ou importez depuis une commande livrée</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Références en stock</p>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-400 jb">{stockUnits} unités</span>
                      <span className="text-sm font-bold jb text-blue-600">{stockValue.toFixed(2)} €</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-0.5">
                    {stockItems.map((item, idx) => (
                      <div key={item.id} className="stock-item" style={{animationDelay:`${idx*30}ms`}}>
                        <StockRow item={item} onUpdate={updateItem} onDelete={deleteItem} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete order modal */}
      {confirmDeleteOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Supprimer la commande ?</p>
                <p className="text-xs text-gray-400 mt-0.5">Cette action est irréversible</p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setConfirmDeleteOrder(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={() => handleDeleteOrder(confirmDeleteOrder)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {importModalOrder && (
        <ImportModal
          order={importModalOrder}
          onImport={handleImportItems}
          onClose={() => setImportModalOrder(null)}
        />
      )}
    </>
  );
}