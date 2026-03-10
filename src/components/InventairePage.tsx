import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  Package, MapPin, Home, Clock, ExternalLink, CheckCircle,
  ChevronRight, Box, Plus, Trash2, Edit2, Check, X,
  Search, Truck, RefreshCw, CalendarClock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useOrders, Order, DeliveryStatus } from '../hooks/useOrders';
import { useStock } from '../hooks/useStock';
import { OrderForm } from './OrderForm';

// ─────────────────────────────────────────────
// Statuts livraison
// ─────────────────────────────────────────────
const STATUS = {
  pending:   { label: 'En transit',  color: '#3b82f6', bg: '#eff6ff', pulse: true  },
  available: { label: 'Au relais',   color: '#f59e0b', bg: '#fffbeb', pulse: true  },
  delivered: { label: 'Livré',       color: '#10b981', bg: '#ecfdf5', pulse: false },
  collected: { label: 'Récupéré',    color: '#9ca3af', bg: '#f9fafb', pulse: false },
};

// ─────────────────────────────────────────────
// Hook cron status
// ─────────────────────────────────────────────
function useCronStatus() {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [, setTick]                   = useState(0);

  const fetchLastRefresh = useCallback(async () => {
    const { data } = await supabase
      .from('orders').select('delivery_date_updated_at')
      .not('delivery_date_updated_at', 'is', null)
      .order('delivery_date_updated_at', { ascending: false })
      .limit(1).maybeSingle();
    if (data?.delivery_date_updated_at) setLastRefresh(new Date(data.delivery_date_updated_at));
  }, []);

  useEffect(() => {
    fetchLastRefresh();
    const tick = setInterval(() => { setTick(t => t + 1); fetchLastRefresh(); }, 60000);
    const ch = supabase.channel('cron_watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchLastRefresh())
      .subscribe();
    return () => { clearInterval(tick); ch.unsubscribe(); };
  }, [fetchLastRefresh]);

  const triggerRefresh = async () => {
    setRefreshing(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: orders } = await supabase.from('orders').select('id, tracking_link')
        .not('tracking_link', 'is', null).neq('tracking_link', '').neq('delivery_status', 'collected');
      await Promise.all((orders || []).map(o =>
        fetch(`${url}/functions/v1/extract_delivery_date`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ order_id: o.id, tracking_url: o.tracking_link }),
        })
      ));
      await fetchLastRefresh();
    } finally { setRefreshing(false); }
  };

  const getStatus = () => {
    if (!lastRefresh) return { label: 'Jamais rafraîchi', color: 'text-red-300', dot: 'bg-red-400' };
    const min = Math.round((Date.now() - lastRefresh.getTime()) / 60000);
    if (min < 45)  return { label: `Màj il y a ${min} min`,              color: 'text-green-300',  dot: 'bg-green-400' };
    if (min < 120) return { label: `Màj il y a ${min} min`,              color: 'text-yellow-300', dot: 'bg-yellow-400' };
    return               { label: `Màj il y a ${Math.round(min/60)}h`,  color: 'text-red-300',    dot: 'bg-red-400' };
  };

  return { cronStatus: getStatus(), refreshing, triggerRefresh };
}

// ─────────────────────────────────────────────
// ConfirmModal générique
// ─────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = 'Confirmer', confirmColor = 'red', extraButton = null }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${confirmColor === 'red' ? 'bg-red-100' : 'bg-blue-100'}`}>
            <Trash2 size={18} className={confirmColor === 'red' ? 'text-red-500' : 'text-blue-500'} />
          </div>
          <p className="font-semibold text-gray-900">{message}</p>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">Annuler</button>
          {extraButton}
          <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${confirmColor === 'red' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// AddItemForm (stock manuel)
// ─────────────────────────────────────────────
function AddItemForm({ onAdd, onCancel }: { onAdd: (name: string, qty: number, price: number) => void; onCancel: () => void }) {
  const [name, setName]   = useState('');
  const [qty, setQty]     = useState('1');
  const [price, setPrice] = useState('');
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
        <button onClick={() => { if (name.trim()) onAdd(name.trim(), parseInt(qty)||1, parseFloat(price)||0); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Check size={14} /> Ajouter
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors"><X size={14} /></button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// StockRow
// ─────────────────────────────────────────────
function StockRow({ item, onUpdate, onDelete }: { item: any; onUpdate: (id: string, data: any) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty]         = useState(String(item.quantity));
  const [price, setPrice]     = useState(String(item.unit_price));
  const save = () => { onUpdate(item.id, { quantity: parseInt(qty)||1, unit_price: parseFloat(price)||0 }); setEditing(false); };
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white jb bg-gradient-to-br from-blue-500 to-blue-400">{item.quantity}</div>
      <span className="flex-1 text-sm text-gray-700 truncate">{item.name}</span>
      {editing ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input type="number" value={qty} onChange={e => setQty(e.target.value)} className="w-14 px-2 py-1 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 jb" />
          <input type="text" value={price} onChange={e => setPrice(e.target.value)} className="w-20 px-2 py-1 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 jb" />
          <button onClick={save} className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700"><Check size={12} /></button>
          <button onClick={() => setEditing(false)} className="p-1 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100"><X size={12} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-400 jb hidden sm:inline">{item.unit_price > 0 ? `${item.unit_price.toFixed(2)} €/u` : '—'}</span>
          <span className="text-sm font-semibold text-gray-900 jb w-16 text-right">{item.unit_price > 0 ? `${(item.quantity * item.unit_price).toFixed(2)} €` : '—'}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"><Edit2 size={13} /></button>
            <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Import modal
// ─────────────────────────────────────────────
function ImportModal({ order, onImport, onClose }: { order: Order; onImport: (items: any[]) => Promise<void>; onClose: () => void }) {
  const [selected, setSelected]     = useState<Record<number, boolean>>(Object.fromEntries(order.items.map((_, i) => [i, false])));
  const [quantities, setQuantities] = useState<Record<number, number>>(Object.fromEntries(order.items.map((item, i) => [i, item.quantity])));
  const [loading, setLoading]       = useState(false);
  const toggleAll = (v: boolean) => setSelected(Object.fromEntries(order.items.map((_, i) => [i, v])));
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleImport = async () => {
    setLoading(true);
    await onImport(order.items.filter((_, i) => selected[i]).map((item, i) => {
      const oi = order.items.indexOf(item);
      return { name: item.name, quantity: quantities[oi] || item.quantity, unit_price: item.price_ttc ?? item.pricePerUnit };
    }));
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{order.supplier_name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Sélectionnez les articles à ajouter au stock</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex items-center justify-between px-6 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-xs text-gray-500 font-medium">{selectedCount} / {order.items.length} sélectionnés</span>
          <div className="flex gap-2">
            <button onClick={() => toggleAll(true)} className="text-xs px-3 py-1 rounded-lg bg-blue-100 text-blue-600 font-medium hover:bg-blue-200">Tout</button>
            <button onClick={() => toggleAll(false)} className="text-xs px-3 py-1 rounded-lg bg-gray-200 text-gray-500 font-medium hover:bg-gray-300">Aucun</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {order.items.map((item, i) => {
            const unitPrice = item.price_ttc ?? item.pricePerUnit;
            const isSel = selected[i];
            return (
              <div key={i} onClick={() => setSelected(p => ({ ...p, [i]: !p[i] }))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                style={{ background: isSel ? '#eff6ff' : '#f9fafb', border: `1px solid ${isSel ? '#bfdbfe' : '#f3f4f6'}` }}>
                <div className="flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center"
                  style={{ borderColor: isSel ? '#3b82f6' : '#d1d5db', background: isSel ? '#3b82f6' : 'white' }}>
                  {isSel && <Check size={11} color="white" />}
                </div>
                <input type="number" value={quantities[i]} min={1} max={item.quantity}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setQuantities(p => ({ ...p, [i]: Math.min(item.quantity, Math.max(1, parseInt(e.target.value)||1)) }))}
                  className="w-12 px-2 py-1 text-xs border border-gray-200 rounded-lg jb text-center focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                <span className="flex-1 text-sm text-gray-700 truncate">{item.name}</span>
                <span className="text-xs text-gray-400 jb flex-shrink-0">{unitPrice.toFixed(2)} €/u</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">Annuler</button>
          <button onClick={handleImport} disabled={loading || selectedCount === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={15} />}
            Ajouter {selectedCount > 0 ? `${selectedCount} article${selectedCount > 1 ? 's' : ''}` : ''} au stock
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────
export function InventairePage() {
  const { user }  = useAuth();
  const { orders: allDbOrders, loading: loadingOrders, addOrder, deleteOrder, updateOrder, updateDeliveryStatus } = useOrders();
  const { items: stockItems, loading: loadingStock, addItem, updateItem, deleteItem, totalValue: stockValue, totalUnits: stockUnits } = useStock();
  const { cronStatus, refreshing, triggerRefresh } = useCronStatus();

  // UI state
  const [tab, setTab]                         = useState<'transit' | 'stock'>('transit');
  const [selected, setSelected]               = useState<string | null>(null);
  const [showForm, setShowForm]               = useState(false);
  const [editingOrder, setEditingOrder]       = useState<Order | null>(null);
  const [importModalOrder, setImportModalOrder] = useState<Order | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAdd, setShowAdd]                 = useState(false);
  const [search, setSearch]                   = useState('');
  const [searchStock, setSearchStock]         = useState('');
  const [sortBy, setSortBy]                   = useState<'name'|'price_asc'|'price_desc'|'qty_asc'|'qty_desc'|'value_desc'|'value_asc'>('name');

  // Commandes actives visibles dans "En transit"
  const pending = useMemo(() =>
    allDbOrders
      .filter(o => o.delivery_status !== 'collected' && !o.hidden_in_stock)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [allDbOrders]);

  // Filtrage gauche par recherche
  const filteredPending = useMemo(() => {
    const STATUS_PRIORITY: Record<string, number> = {
      delivered: 0,  // livré → en haut
      available: 1,  // au relais
      pending:   2,  // en transit
      collected: 3,
    };

    let list = [...pending];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.supplier_name.toLowerCase().includes(q) ||
        o.items.some(i => i.name.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => {
      const pa = STATUS_PRIORITY[a.delivery_status ?? 'pending'] ?? 2;
      const pb = STATUS_PRIORITY[b.delivery_status ?? 'pending'] ?? 2;
      if (pa !== pb) return pa - pb;
      // Même statut → par date de livraison (la plus proche en premier), puis alphabétique
      const da = a.expected_delivery_date ? new Date(a.expected_delivery_date).getTime() : Infinity;
      const db = b.expected_delivery_date ? new Date(b.expected_delivery_date).getTime() : Infinity;
      if (da !== db) return da - db;
      return a.supplier_name.localeCompare(b.supplier_name);
    });
  }, [pending, search]);

  const selectedOrder = filteredPending.find(o => o.id === selected) ?? filteredPending[0] ?? null;

  // Auto-select first when list changes
  useEffect(() => {
    if (filteredPending.length > 0 && !filteredPending.find(o => o.id === selected)) {
      setSelected(filteredPending[0].id);
    }
  }, [filteredPending]);

  // Stats
  const transitValue = useMemo(() => pending.reduce((s, o) => s + o.total_price, 0), [pending]);
  const transitUnits = useMemo(() => pending.reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0), 0), [pending]);

  // Bandeau livraisons (sur tous les allDbOrders non collected)
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const deliveries = useMemo(() => {
    const active = allDbOrders.filter(o => o.delivery_status !== 'collected');
    const withDate = active.filter(o => o.expected_delivery_date).map(o => {
      const date = new Date(o.expected_delivery_date!); date.setHours(0,0,0,0);
      const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
      return { order: o, date, diffDays, noTracking: false };
    }).sort((a, b) => a.diffDays - b.diffDays);
    const withDateIds = new Set(withDate.map(d => d.order.id));
    const withoutDate = active
      .filter(o => !o.expected_delivery_date && o.delivery_status !== 'delivered' && !withDateIds.has(o.id))
      .map(o => ({ order: o, date: null as any, diffDays: 999, noTracking: !o.tracking_link }));
    return [...withDate, ...withoutDate];
  }, [allDbOrders, today]);

  const relaisCount   = deliveries.filter(d => d.order.delivery_status === 'available').length;
  const lateCount     = deliveries.filter(d => d.diffDays < 0 && d.order.delivery_status !== 'delivered' && d.order.delivery_status !== 'available').length;
  const todayCount    = deliveries.filter(d => d.diffDays === 0 && d.order.delivery_status !== 'delivered' && d.order.delivery_status !== 'available').length;
  const upcomingCount = deliveries.filter(d => d.diffDays > 0 && d.order.delivery_status !== 'delivered' && d.order.delivery_status !== 'available').length;

  const getUrgency = (diffDays: number, status: string) => {
    if (status === 'available') return { text: 'Disponible au relais', dot: 'bg-amber-400' };
    if (status === 'delivered') return { text: 'Livré', dot: 'bg-emerald-500' };
    if (diffDays < 0)  return { text: `En retard`,          dot: 'bg-red-500' };
    if (diffDays === 0) return { text: "Aujourd'hui",        dot: 'bg-green-500' };
    if (diffDays === 1) return { text: 'Demain',             dot: 'bg-blue-500' };
    return               { text: `Dans ${diffDays}j`,        dot: 'bg-gray-400' };
  };

  // Stock filtré + trié
  const filteredStock = useMemo(() => {
    let items = [...stockItems];
    if (searchStock.trim()) { const q = searchStock.toLowerCase(); items = items.filter(i => i.name.toLowerCase().includes(q)); }
    switch (sortBy) {
      case 'name':       items.sort((a,b) => a.name.localeCompare(b.name)); break;
      case 'price_asc':  items.sort((a,b) => a.unit_price - b.unit_price); break;
      case 'price_desc': items.sort((a,b) => b.unit_price - a.unit_price); break;
      case 'qty_asc':    items.sort((a,b) => a.quantity - b.quantity); break;
      case 'qty_desc':   items.sort((a,b) => b.quantity - a.quantity); break;
      case 'value_asc':  items.sort((a,b) => (a.quantity*a.unit_price)-(b.quantity*b.unit_price)); break;
      case 'value_desc': items.sort((a,b) => (b.quantity*b.unit_price)-(a.quantity*a.unit_price)); break;
    }
    return items;
  }, [stockItems, searchStock, sortBy]);

  // Helpers
  const fmtShort = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const fmtLong  = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const daysLeft = (d: string) => { const t = new Date(); t.setHours(0,0,0,0); const x = new Date(d); x.setHours(0,0,0,0); return Math.round((x.getTime()-t.getTime())/86400000); };

  // Handlers
  const handleImportItems = async (items: any[]) => {
    const orderId = importModalOrder?.id;
    for (const item of items) await addItem({ name: item.name, quantity: item.quantity, unit_price: item.unit_price, source_order_id: orderId });
    if (orderId) {
      await supabase.from('orders').update({ hidden_in_stock: true }).eq('id', orderId);
    }
    setTab('stock');
  };

  const handleDeleteOrder = async (orderId: string) => {
    await supabase.from('orders').update({ hidden_in_stock: true }).eq('id', orderId);
    setSelected(null);
    setConfirmDeleteId(null);
  };

  const handleAddOrder    = async (d: any) => { await addOrder(d); setShowForm(false); };
  const handleUpdateOrder = async (d: any) => { if (editingOrder) { await updateOrder(editingOrder.id, d); setEditingOrder(null); setShowForm(false); } };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        .inv-page * { box-sizing: border-box; }
        .inv-page { font-family:'Inter',ui-sans-serif,system-ui,sans-serif; font-size:14px; -webkit-font-smoothing:antialiased; }
        .jb { font-family:'Inter',ui-sans-serif,system-ui,sans-serif; }
        @keyframes pdot{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes pring{0%{transform:scale(.9);opacity:.6}100%{transform:scale(2.4);opacity:0}}
        @keyframes fadein{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        .dot-p{animation:pdot 2s ease-in-out infinite}
        .ring-p{position:absolute;inset:-5px;border-radius:50%;animation:pring 2s ease-out infinite}
        .detail-anim{animation:fadein .2s ease}
        .order-row{transition:all .15s ease;border-radius:10px;cursor:pointer}
        .order-row:hover{background:#f1f5f9}
        .order-row.active{background:white;box-shadow:0 1px 8px rgba(0,0,0,.08)}
        .stock-row{animation:slideUp .2s ease both}
      `}</style>

      <div className="inv-page min-h-screen" style={{ background: '#f4f6fb' }}>
        <div className="max-w-6xl mx-auto px-4 py-8">

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase jb mb-1">Inventaire</p>
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Mes commandes</h1>
            </div>
            <button
              onClick={() => { setEditingOrder(null); setShowForm(true); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
              <Plus size={16} /> Ajouter une commande
            </button>
          </div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label:'En transit',     val:`${transitValue.toFixed(2)} €`, sub:`${pending.length} commandes`,    icon:'🚚', iconBg:'#eff6ff', t:'transit' as const },
              { label:'Unités transit', val:String(transitUnits),           sub:'unités commandées',               icon:'📦', iconBg:'#ecfdf5', t:'transit' as const },
              { label:'Mon stock',      val:`${stockValue.toFixed(2)} €`,   sub:`${stockItems.length} références`, icon:'🏠', iconBg:'#f5f3ff', t:'stock' as const },
              { label:'Unités stock',   val:String(stockUnits),             sub:'unités disponibles',              icon:'✅', iconBg:'#fff7ed', t:'stock' as const },
            ].map((s,i) => (
              <button key={i} onClick={() => setTab(s.t)}
                className={`text-left bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-all ${tab === s.t ? 'ring-2 ring-blue-400' : ''}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: s.iconBg }}>{s.icon}</div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium truncate">{s.label}</p>
                  <p className="text-lg font-bold text-gray-900 jb leading-tight">{s.val}</p>
                  <p className="text-xs text-gray-400">{s.sub}</p>
                </div>
              </button>
            ))}
          </div>

          {/* ── Tabs + cron status ── */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm">
              <button onClick={() => setTab('transit')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'transit' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                🚚 En transit <span className="ml-1.5 text-xs opacity-70">{pending.length}</span>
              </button>
              <button onClick={() => setTab('stock')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'stock' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                🏠 Mon stock <span className="ml-1.5 text-xs opacity-70">{stockItems.length}</span>
              </button>
            </div>
            {/* Cron status + refresh */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm text-xs">
              {lateCount > 0     && <span className="flex items-center gap-1 text-red-500 font-medium"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{lateCount} en retard</span>}
              {relaisCount > 0   && <span className="flex items-center gap-1 text-amber-500 font-medium"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{relaisCount} au relais</span>}
              {todayCount > 0    && <span className="flex items-center gap-1 text-emerald-600 font-medium"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />{todayCount} aujourd'hui</span>}
              {upcomingCount > 0 && <span className="flex items-center gap-1 text-blue-500 font-medium"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />{upcomingCount} à venir</span>}
              {(lateCount > 0 || relaisCount > 0 || todayCount > 0 || upcomingCount > 0) && <span className="text-gray-200">|</span>}
              <span className={`flex items-center gap-1 ${cronStatus.color.replace('text-', 'text-').replace('-300', '-500')}`}>
                <span className={`w-2 h-2 rounded-full ${cronStatus.dot}`} />
                {cronStatus.label}
              </span>
              <button onClick={triggerRefresh} disabled={refreshing}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50 font-medium">
                <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refresh...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* ══════════════ TAB EN TRANSIT ══════════════ */}
          {tab === 'transit' && (
            pending.length === 0 ? (
              <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
                <CheckCircle size={48} className="text-emerald-300 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-700">Aucune commande en cours</p>
                <button onClick={() => { setEditingOrder(null); setShowForm(true); }}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 mx-auto">
                  <Plus size={15} /> Ajouter une commande
                </button>
              </div>
            ) : (
              <div className="flex gap-4 items-start">

                {/* ── Colonne gauche ── */}
                <div className="w-96 flex-shrink-0 bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden">
                  {/* Search dans la liste */}
                  <div className="p-2 border-b border-gray-50">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
                        className="w-full pl-8 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12} /></button>}
                    </div>
                  </div>
                  {/* List */}
                  <div className="p-2 flex flex-col gap-1 overflow-y-auto max-h-[600px]">
                    {filteredPending.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Aucun résultat</p>
                    ) : filteredPending.map((order) => {
                      const st  = (order.delivery_status ?? 'pending') as keyof typeof STATUS;
                      const cfg = STATUS[st];
                      const qty = order.items.reduce((s,i) => s + i.quantity, 0);
                      const dl  = order.expected_delivery_date ? daysLeft(order.expected_delivery_date) : null;
                      const isActive = order.id === selectedOrder?.id;
                      return (
                        <div key={order.id} className={`order-row px-3 py-3 ${isActive ? 'active' : ''}`} onClick={() => setSelected(order.id)}>
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex-shrink-0 w-2.5 h-2.5">
                              <div className="w-2.5 h-2.5 rounded-full dot-p" style={{ background: cfg.color }} />
                              {cfg.pulse && <div className="ring-p border" style={{ borderColor: cfg.color }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-sm font-semibold text-gray-900 truncate">{order.supplier_name}</p>
                                <ChevronRight size={14} className={`flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-300'}`} />
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <p className="text-xs text-gray-400">{qty} unités</p>
                                {st === 'delivered' ? (
                                  <p className="text-xs font-semibold text-emerald-500">{order.delivery_type === 'pickup' ? 'Récupéré' : 'Livré'}</p>
                                ) : st === 'available' ? (
                                  <p className="text-xs font-medium text-amber-500">Au relais</p>
                                ) : order.expected_delivery_date ? (
                                  <p className={`text-xs font-medium ${dl !== null && dl < 0 ? 'text-red-400' : dl === 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                                    {dl === 0 ? 'Auj.' : fmtShort(order.expected_delivery_date)}
                                  </p>
                                ) : <p className="text-xs text-gray-300">—</p>}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 h-0.5 rounded-full overflow-hidden bg-gray-100">
                            <div className="h-full rounded-full transition-all" style={{
                              background: st === 'delivered' ? '#10b981' : st === 'available' ? '#f59e0b' : '#3b82f6',
                              width: st === 'delivered' ? '100%' : st === 'available' ? '70%' : '35%'
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Colonne droite : détail ── */}
                {selectedOrder && (() => {
                  const st  = (selectedOrder.delivery_status ?? 'pending') as keyof typeof STATUS;
                  const cfg = STATUS[st];
                  const qty = selectedOrder.items.reduce((s,i) => s + i.quantity, 0);
                  const dl  = selectedOrder.expected_delivery_date ? daysLeft(selectedOrder.expected_delivery_date) : null;
                  return (
                    <div key={selectedOrder.id} className="flex-1 detail-anim space-y-3 min-w-0">
                      {/* Header */}
                      <div className="bg-white rounded-2xl shadow-sm p-5" style={{ borderTop: '3px solid #3b82f6' }}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{selectedOrder.supplier_name}</h2>
                            <p className="text-sm text-gray-400 mt-0.5">Commandé le {fmtLong(selectedOrder.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {selectedOrder.delivery_type === 'pickup'
                              ? <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-600 bg-blue-50"><MapPin size={11} />Point relais</span>
                              : selectedOrder.delivery_type === 'home'
                              ? <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 bg-gray-50"><Home size={11} />Domicile</span>
                              : null}
                            <span className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                            {selectedOrder.tracking_link && (
                              <a href={selectedOrder.tracking_link} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-white hover:opacity-80 transition-opacity" style={{ background: cfg.color }}>
                                <ExternalLink size={11} />Suivi
                              </a>
                            )}
                            <button onClick={() => setImportModalOrder(selectedOrder)}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors">
                              <Plus size={11} />Ajouter au stock
                            </button>
                            <button onClick={() => { setEditingOrder(selectedOrder); setShowForm(true); }}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                              <Edit2 size={11} />Modifier
                            </button>
                            <button onClick={() => setConfirmDeleteId(selectedOrder.id)}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                              <Trash2 size={11} />Supprimer
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-50 flex-wrap">
                          <div className="flex items-center gap-1.5 text-sm text-gray-500"><Box size={14} className="text-gray-300" /><span><strong className="text-gray-800">{qty}</strong> unités</span></div>
                          <div className="flex items-center gap-1.5 text-sm text-gray-500"><Package size={14} className="text-gray-300" /><span><strong className="text-gray-800">{selectedOrder.items.length}</strong> articles</span></div>
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
                            <p className="text-2xl font-bold jb text-blue-600">{selectedOrder.total_price.toFixed(2)} €</p>
                          </div>
                        </div>
                      </div>
                      {/* Articles */}
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
                                <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white jb"
                                  style={{ background: 'linear-gradient(135deg,#3b82f6,#60a5fa)' }}>{item.quantity}</div>
                                <span className="flex-1 text-sm text-gray-700 truncate">{item.name}</span>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  {item.quantity > 1 && <span className="text-xs text-gray-300 jb hidden sm:inline">{unit}×{item.quantity}</span>}
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

          {/* ══════════════ TAB MON STOCK ══════════════ */}
          {tab === 'stock' && (
            <div className="space-y-3">
              {/* Barre recherche + tri + ajouter */}
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={searchStock} onChange={e => setSearchStock(e.target.value)} placeholder="Rechercher un produit..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm" />
                  {searchStock && <button onClick={() => setSearchStock('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>}
                </div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                  className="px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm text-gray-600 cursor-pointer">
                  <option value="name">Nom (A→Z)</option>
                  <option value="qty_desc">Unités ↓</option>
                  <option value="qty_asc">Unités ↑</option>
                  <option value="price_desc">Prix unitaire ↓</option>
                  <option value="price_asc">Prix unitaire ↑</option>
                  <option value="value_desc">Valeur totale ↓</option>
                  <option value="value_asc">Valeur totale ↑</option>
                </select>
                <button onClick={() => setShowAdd(v => !v)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-all ${showAdd ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  <Plus size={15} /> Ajouter
                </button>
              </div>
              {showAdd && <AddItemForm onAdd={async (name, qty, price) => { await addItem({ name, quantity: qty, unit_price: price }); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />}
              {loadingStock ? (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm"><div className="w-8 h-8 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mx-auto" /></div>
              ) : stockItems.length === 0 ? (
                <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4"><Package size={32} className="text-blue-300" /></div>
                  <p className="text-lg font-semibold text-gray-700">Stock vide</p>
                  <p className="text-sm text-gray-400 mt-1">Ajoutez des articles ou importez depuis une commande</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Références en stock</p>
                      {searchStock && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">{filteredStock.length} résultat{filteredStock.length !== 1 ? 's' : ''}</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-400 jb">{stockUnits} unités</span>
                      <span className="text-sm font-bold jb text-blue-600">{stockValue.toFixed(2)} €</span>
                    </div>
                  </div>
                  {filteredStock.length === 0 ? (
                    <div className="p-12 text-center"><p className="text-sm text-gray-400">Aucun résultat pour "<span className="font-medium text-gray-600">{searchStock}</span>"</p></div>
                  ) : (
                    <div className="p-3 space-y-0.5">
                      {filteredStock.map((item, idx) => (
                        <div key={item.id} className="stock-row" style={{ animationDelay: `${idx*20}ms` }}>
                          <StockRow item={item} onUpdate={updateItem} onDelete={deleteItem} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Modales ── */}
      {confirmDeleteId && (
        <ConfirmModal message="Supprimer cette commande ?" confirmLabel="Supprimer" confirmColor="red"
          onConfirm={() => handleDeleteOrder(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)} />
      )}

      {importModalOrder && (
        <ImportModal order={importModalOrder}
          onImport={handleImportItems}
          onClose={() => setImportModalOrder(null)} />
      )}
      {showForm && (
        <OrderForm
          onSubmit={editingOrder ? handleUpdateOrder : handleAddOrder}
          onClose={() => { setShowForm(false); setEditingOrder(null); }}
          initialData={editingOrder || undefined}
          isLoading={loadingOrders} />
      )}
    </>
  );
}