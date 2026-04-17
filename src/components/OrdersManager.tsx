import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Plus, Euro, Package, ShoppingCart, Truck, CalendarClock, Home, MapPin, CheckCheck, RefreshCw, Files, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useOrders, callAfterShip, Order, DeliveryStatus } from '../hooks/useOrders';
import { OrderForm } from './OrderForm';
import { OrdersList } from './OrdersList';
import { supabase } from '../lib/supabase';

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

function useCronStatus(fetchOrders: () => Promise<void>) {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [, setTick] = useState(0);
  const isRefreshingRef = useRef(false);

  const triggerRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setRefreshing(true);
    try {
      const { data: ordersToRefresh } = await supabase
        .from('orders')
        .select('id, tracking_link')
        .not('tracking_link', 'is', null)
        .neq('tracking_link', '')
        .neq('delivery_status', 'collected')
        .neq('delivery_status', 'delivered')
        .neq('delivery_status', 'available');
      for (const o of (ordersToRefresh || [])) {
        await callAfterShip(o.id, o.tracking_link!);
        await new Promise(r => setTimeout(r, 800));
      }
      setLastRefresh(new Date());
      await fetchOrders();
    } finally {
      isRefreshingRef.current = false;
      setRefreshing(false);
    }
  }, [fetchOrders]);

  // Re-render toutes les minutes pour le label
  useEffect(() => {
    const tick = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(tick);
  }, []);

  // Auto-refresh toutes les X minutes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log(`[Auto-refresh] ${AUTO_REFRESH_INTERVAL / 60000} min`);
      triggerRefresh();
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [triggerRefresh]);

  const getStatus = () => {
    if (!lastRefresh) return { label: 'Jamais rafraîchi', color: 'text-red-300', dot: 'bg-red-400' };
    const minAgo = Math.round((Date.now() - lastRefresh.getTime()) / 60000);
    if (minAgo < 45)  return { label: `Màj il y a ${minAgo} min`, color: 'text-green-300',  dot: 'bg-green-400' };
    if (minAgo < 120) return { label: `Màj il y a ${minAgo} min`, color: 'text-yellow-300', dot: 'bg-yellow-400' };
    return { label: `Màj il y a ${Math.round(minAgo / 60)}h`, color: 'text-red-300', dot: 'bg-red-400' };
  };

  return { status: getStatus(), refreshing, triggerRefresh };
}

const STATUS_CONFIG = {
  pending:   { label: 'En attente',    color: 'text-gray-500',   bg: 'bg-gray-100',   border: 'border-gray-200' },
  delivered: { label: 'Livré',         color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-300' },
  available: { label: 'À disposition', color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-blue-300' },
  collected: { label: 'Récupéré',      color: 'text-purple-700', bg: 'bg-purple-100', border: 'border-purple-300' },
} as const;

function ConfirmModal({ message, onConfirm, onCancel, extraButton = null, confirmColor = "red" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-100 p-2.5 rounded-xl"><CheckCheck size={20} className="text-blue-600" /></div>
          <h3 className="text-base font-semibold text-gray-900">Confirmation</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Annuler</button>
          {extraButton}
          <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${confirmColor === "blue" ? "bg-blue-600 hover:bg-blue-700" : "bg-red-500 hover:bg-red-600"}`}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}

function DeliveryBanner({ orders, onStatusChange, onDelete, cronStatus, onRefresh, refreshing }: {
  orders: Order[];
  onStatusChange: (id: string, status: DeliveryStatus) => void;
  onDelete: (id: string) => void;
  cronStatus: { label: string; color: string; dot: string };
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [dismissOrder, setDismissOrder] = useState<string | null>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deliveries = useMemo(() => {
    const activeOrders = orders.filter(o => o.delivery_status !== 'collected');

    // 1. Commandes avec date de livraison
    const withDate = activeOrders
      .filter(o => o.expected_delivery_date)
      .map(o => {
        const date = new Date(o.expected_delivery_date!);
        date.setHours(0, 0, 0, 0);
        const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { order: o, date, diffDays, noTracking: false };
      })
      .sort((a, b) => a.diffDays - b.diffDays);

    const withDateIds = new Set(withDate.map(d => d.order.id));

    // 2. Toutes les commandes actives sans date (peu importe le lien de suivi)
    const withoutDate = activeOrders
      .filter(o =>
        !o.expected_delivery_date &&
        o.delivery_status !== 'delivered' &&
        !withDateIds.has(o.id)
      )
      .map(o => ({ order: o, date: null as any, diffDays: 999, noTracking: !o.tracking_link }));

    return [...withDate, ...withoutDate];
  }, [orders]);

  if (deliveries.length === 0) return null;

  const getUrgency = (diffDays: number) => {
    if (diffDays < 0)   return { text: 'En retard',              dot: 'bg-red-500' };
    if (diffDays === 0) return { text: "Aujourd'hui",             dot: 'bg-green-500' };
    if (diffDays === 1) return { text: 'Demain',                  dot: 'bg-blue-500' };
    if (diffDays <= 3)  return { text: `Dans ${diffDays}j`,       dot: 'bg-indigo-400' };
    return               { text: `Dans ${diffDays}j`,             dot: 'bg-gray-400' };
  };

  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const lateCount     = deliveries.filter(d => d.diffDays < 0 && d.order.delivery_status !== 'delivered' && d.order.delivery_status !== 'collected').length;
  const todayCount    = deliveries.filter(d => d.diffDays === 0 && d.order.delivery_status !== 'delivered' && d.order.delivery_status !== 'collected').length;
  const upcomingCount = deliveries.filter(d => d.diffDays > 0 && d.order.delivery_status !== 'delivered' && d.order.delivery_status !== 'collected').length;

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600">
        <Truck size={18} className="text-white" />
        <span className="text-white font-semibold text-sm">Livraisons à venir</span>
        <div className="ml-auto flex items-center gap-4 text-xs text-blue-100">
          {lateCount > 0     && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{lateCount} en retard</span>}
          {todayCount > 0    && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />{todayCount} aujourd'hui</span>}
          {upcomingCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-300 inline-block" />{upcomingCount} à venir</span>}
          <div className="flex items-center gap-2 pl-3 border-l border-white/20">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cronStatus.dot}`} />
            <span className={`hidden sm:inline ${cronStatus.color}`}>{cronStatus.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              disabled={refreshing}
              title="Rafraîchir maintenant"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50 text-white"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{refreshing ? 'Refresh...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {deliveries.map(({ order, date, diffDays, noTracking }) => {
          const status    = (order.delivery_status ?? 'pending') as DeliveryStatus;
          const statusCfg = STATUS_CONFIG[status];
          const urgency   = noTracking
            ? { text: 'En attente du lien de suivi', dot: 'bg-gray-400' }
            : status === 'available'
            ? { text: 'En attente', dot: 'bg-blue-500' }
            : status === 'delivered'
            ? { text: 'Livré', dot: 'bg-green-500' }
            : getUrgency(diffDays);
          const firstItem = order.items?.[0];
          const itemCount = order.items?.length ?? 0;
          const isDone    = status === 'collected' || status === 'delivered';
          return (
            <div key={order.id} onClick={() => order.tracking_link && window.open(order.tracking_link, '_blank')} className={`px-5 py-3 transition-colors cursor-pointer ${isDone ? 'bg-gray-50 hover:bg-gray-100' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${urgency.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{order.supplier_name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {firstItem ? `${firstItem.quantity}x ${firstItem.name}` : '-'}
                    {itemCount > 1 && ` +${itemCount - 1} autre${itemCount > 2 ? 's' : ''}`}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                  <CalendarClock size={13} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{date ? fmt(date) : '—'}</span>
                </div>
                <span className="text-xs font-medium text-gray-500 flex-shrink-0">{urgency.text}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {status === 'pending' && !noTracking && (
                    <span className={order.delivery_type === 'pickup'
                      ? 'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-blue-200 text-blue-500 bg-blue-50'
                      : 'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 bg-gray-50'
                    }>
                      {order.delivery_type === 'pickup'
                        ? <><MapPin size={11} /><span className="hidden sm:inline">Point relais</span></>
                        : <><Home size={11} /><span className="hidden sm:inline">Domicile</span></>
                      }
                    </span>
                  )}
                  {status === 'available' && (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-blue-300 text-blue-700 bg-blue-50 font-medium">
                        <MapPin size={11} />Disponible au relais
                      </span>

                    </div>
                  )}
                  {isDone && status !== 'available' && (
                    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border}`}>
                      {statusCfg.label}
                    </span>
                  )}
                  {isDone && (
                    <button onClick={(e) => { e.stopPropagation(); setDismissOrder(order.id); }}
                      className="text-xs text-gray-400 hover:text-red-500 px-1 transition-colors" title="Retirer">✕</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {dismissOrder && (
        <ConfirmModal
          message="Que souhaitez-vous faire avec cette commande ?"
          onConfirm={() => { onDelete(dismissOrder); setDismissOrder(null); }}
          onCancel={() => setDismissOrder(null)}
          extraButton={
            <button
              onClick={() => { onStatusChange(dismissOrder, 'collected'); setDismissOrder(null); }}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Archiver
            </button>
          }
        />
      )}
    </div>
  );
}

export function OrdersManager() {
  const { orders, loading, addOrder, deleteOrder, updateOrder, updateDeliveryStatus, fetchOrders } = useOrders();
  const { status: cronStatus, refreshing, triggerRefresh } = useCronStatus(fetchOrders);
  const [showForm, setShowForm]             = useState(false);
  const [editingOrder, setEditingOrder]     = useState<Order | null>(null);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);

  const stats = useMemo(() => {
    const src        = filteredOrders.length === 0 && orders.length > 0 ? orders : filteredOrders;
    const totalValue = src.reduce((s, o) => s + o.total_price, 0);
    const totalUnits = src.reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0), 0);
    return { totalValue, totalUnits, totalOrders: src.length };
  }, [orders, filteredOrders]);

  const handleAddOrder    = async (d: Omit<Order, 'id'|'created_at'|'updated_at'>) => { await addOrder(d); setShowForm(false); };
  const handleEditOrder   = (o: Order) => { setEditingOrder(o); setShowForm(true); };
  const handleUpdateOrder = async (d: Omit<Order, 'id'|'created_at'|'updated_at'>) => {
    if (editingOrder) { await updateOrder(editingOrder.id, d); setEditingOrder(null); setShowForm(false); }
  };
  const handleCloseForm = () => { setShowForm(false); setEditingOrder(null); };

  const handleDuplicateOrder = async (order: Order, times: number) => {
    const base: Omit<Order, 'id'|'created_at'|'updated_at'> = {
      supplier_name:            order.supplier_name,
      items:                    order.items,
      total_price:              order.total_price,
      tracking_link:            null,
      order_link:               order.order_link,
      expected_delivery_date:   null,
      delivery_status:          'pending',
      delivery_type:            order.delivery_type,
      delivery_date_updated_at: null,
      tracking_checkpoints:     null,
      notes:                    null,
      hidden_in_orders:         false,
    };
    for (let i = 0; i < times; i++) {
      await addOrder(base);
    }
  };

  // ── Multi-invoice upload state ──────────────────────────────────────────────
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [batchFiles, setBatchFiles]           = useState<File[]>([]);
  const [batchResults, setBatchResults]       = useState<{file: string, status: 'pending'|'processing'|'done'|'error', msg?: string}[]>([]);
  const [batchRunning, setBatchRunning]       = useState(false);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const runBatchExtraction = async () => {
    if (batchFiles.length === 0) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;
    setBatchRunning(true);
    const results = batchFiles.map(f => ({ file: f.name, status: 'pending' as const }));
    setBatchResults([...results]);

    for (let i = 0; i < batchFiles.length; i++) {
      setBatchResults(prev => prev.map((r, j) => j === i ? { ...r, status: 'processing' } : r));
      try {
        const file = batchFiles[i];
        const base64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string).split(',')[1]);
          reader.onerror = () => rej(new Error('Lecture échouée'));
          reader.readAsDataURL(file);
        });
        const mediaType = file.type === 'application/pdf' ? 'application/pdf' : file.type;
        const response = await fetch(`${supabaseUrl}/functions/v1/extract_order_data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ file_base64: base64, media_type: mediaType }),
        });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || 'Extraction échouée');
        await addOrder({
          supplier_name:          data.supplier_name || 'Fournisseur inconnu',
          items:                  data.items || [],
          total_price:            data.total_price || 0,
          tracking_link:          data.tracking_link || null,
          order_link:             data.order_link || null,
          expected_delivery_date: null,
          delivery_status:        'pending',
          delivery_type:          null,
          delivery_date_updated_at: null,
          notes:                  null,
          tracking_checkpoints:   null,
          hidden_in_orders:       false,
        });
        setBatchResults(prev => prev.map((r, j) => j === i ? { ...r, status: 'done', msg: data.supplier_name || '✓' } : r));
      } catch (e) {
        setBatchResults(prev => prev.map((r, j) => j === i ? { ...r, status: 'error', msg: e instanceof Error ? e.message : 'Erreur' } : r));
      }
    }
    setBatchRunning(false);
  };

  return (
    <div className="py-8 px-4 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mes Commandes</h1>
            <p className="text-gray-600 mt-1">Gérez toutes vos commandes en un seul endroit</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setShowBatchUpload(true); setBatchFiles([]); setBatchResults([]); }}
              className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-5 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              <Files size={18} />Importer des factures
            </button>
            <button onClick={() => { setEditingOrder(null); setShowForm(true); }}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              <Plus size={20} />Ajouter une commande
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-3 rounded-lg"><Euro className="text-blue-600" size={24} /></div>
              <div><p className="text-sm text-gray-500 font-medium">Valeur totale</p><p className="text-2xl font-bold text-gray-900">{stats.totalValue.toFixed(2)} €</p></div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 p-3 rounded-lg"><Package className="text-green-600" size={24} /></div>
              <div><p className="text-sm text-gray-500 font-medium">Unités totales</p><p className="text-2xl font-bold text-gray-900">{stats.totalUnits}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-orange-100 p-3 rounded-lg"><ShoppingCart className="text-orange-600" size={24} /></div>
              <div><p className="text-sm text-gray-500 font-medium">Nombre de commandes</p><p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p></div>
            </div>
          </div>
        </div>

        {!loading && <DeliveryBanner orders={orders} onStatusChange={updateDeliveryStatus} onDelete={deleteOrder} cronStatus={cronStatus} onRefresh={triggerRefresh} refreshing={refreshing} />}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            <p className="mt-4 text-gray-600">Chargement des commandes...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <OrdersList orders={orders} onEdit={handleEditOrder} onDelete={deleteOrder} onDuplicate={handleDuplicateOrder} isLoading={loading} onFilteredOrdersChange={setFilteredOrders} />
          </div>
        )}

        {showForm && (
          <OrderForm onSubmit={editingOrder ? handleUpdateOrder : handleAddOrder} onClose={handleCloseForm} initialData={editingOrder || undefined} isLoading={loading} />
        )}

        {/* Modal import multi-factures */}
        {showBatchUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">Importer plusieurs factures</h3>
                <button onClick={() => !batchRunning && setShowBatchUpload(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Chaque fichier créera une commande indépendante via l'IA.</p>

              {/* Drop zone */}
              {!batchRunning && batchResults.length === 0 && (
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors mb-4"
                  onClick={() => batchInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); setBatchFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')); }}
                >
                  <Files size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">Glisser-déposer ou cliquer</p>
                  <p className="text-xs text-gray-400 mt-1">PDF ou images — une commande par fichier</p>
                  <input ref={batchInputRef} type="file" multiple accept="image/*,.pdf" className="hidden"
                    onChange={e => setBatchFiles(Array.from(e.target.files || []))} />
                </div>
              )}

              {/* File list */}
              {batchFiles.length > 0 && batchResults.length === 0 && (
                <div className="mb-4 space-y-1 max-h-48 overflow-y-auto">
                  {batchFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-sm">
                      <span className="flex-1 truncate text-gray-700">{f.name}</span>
                      <button onClick={() => setBatchFiles(prev => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400"><XCircle size={14} /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress */}
              {batchResults.length > 0 && (
                <div className="mb-4 space-y-2 max-h-64 overflow-y-auto">
                  {batchResults.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100">
                      {r.status === 'pending'    && <div className="w-4 h-4 rounded-full bg-gray-200 flex-shrink-0" />}
                      {r.status === 'processing' && <Loader2 size={16} className="animate-spin text-blue-500 flex-shrink-0" />}
                      {r.status === 'done'       && <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />}
                      {r.status === 'error'      && <XCircle size={16} className="text-red-400 flex-shrink-0" />}
                      <span className="flex-1 text-sm text-gray-700 truncate">{r.file}</span>
                      {r.msg && <span className={`text-xs flex-shrink-0 ${r.status === 'error' ? 'text-red-400' : 'text-emerald-600'}`}>{r.msg}</span>}
                    </div>
                  ))}
                  {!batchRunning && (
                    <p className="text-xs text-center text-gray-400 pt-1">
                      {batchResults.filter(r => r.status === 'done').length}/{batchResults.length} commandes créées
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => !batchRunning && setShowBatchUpload(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50" disabled={batchRunning}>
                  {batchResults.some(r => r.status === 'done') ? 'Fermer' : 'Annuler'}
                </button>
                {batchResults.length === 0 && (
                  <button onClick={runBatchExtraction} disabled={batchFiles.length === 0 || batchRunning}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    <Files size={15} /> Extraire {batchFiles.length > 0 ? `${batchFiles.length} facture${batchFiles.length > 1 ? 's' : ''}` : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}