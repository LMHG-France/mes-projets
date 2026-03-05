import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Euro, Package, ShoppingCart, Truck, CalendarClock, Home, MapPin, CheckCheck, RefreshCw } from 'lucide-react';
import { useOrders, Order, DeliveryStatus } from '../hooks/useOrders';
import { OrderForm } from './OrderForm';
import { OrdersList } from './OrdersList';
import { supabase } from '../lib/supabase';

function useCronStatus() {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing]   = useState(false);

  const fetchLastRefresh = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('delivery_date_updated_at')
      .not('delivery_date_updated_at', 'is', null)
      .order('delivery_date_updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.delivery_date_updated_at) setLastRefresh(new Date(data.delivery_date_updated_at));
  }, []);

  useEffect(() => { fetchLastRefresh(); }, [fetchLastRefresh]);

  const triggerRefresh = async () => {
    setRefreshing(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: orders } = await supabase
        .from('orders')
        .select('id, tracking_link')
        .not('tracking_link', 'is', null)
        .neq('tracking_link', '')
        .neq('delivery_status', 'collected');
      await Promise.all((orders || []).map(o =>
        fetch(`${supabaseUrl}/functions/v1/extract_delivery_date`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ order_id: o.id, tracking_url: o.tracking_link }),
        })
      ));
      await fetchLastRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatus = () => {
    if (!lastRefresh) return { label: 'Jamais rafraîchi', color: 'text-red-300', dot: 'bg-red-400' };
    const minAgo = Math.round((Date.now() - lastRefresh.getTime()) / 60000);
    if (minAgo < 45)  return { label: `Màj il y a ${minAgo} min`, color: 'text-green-300', dot: 'bg-green-400' };
    if (minAgo < 120) return { label: `Màj il y a ${minAgo} min`, color: 'text-yellow-300', dot: 'bg-yellow-400' };
    const hAgo = Math.round(minAgo / 60);
    return { label: `Màj il y a ${hAgo}h`, color: 'text-red-300', dot: 'bg-red-400' };
  };

  return { status: getStatus(), refreshing, triggerRefresh };
}

const STATUS_CONFIG = {
  pending:   { label: 'En attente',    color: 'text-gray-500',   bg: 'bg-gray-100',   border: 'border-gray-200' },
  delivered: { label: 'Livré',         color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-300' },
  available: { label: 'À disposition', color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-blue-300' },
  collected: { label: 'Récupéré',      color: 'text-purple-700', bg: 'bg-purple-100', border: 'border-purple-300' },
} as const;

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-purple-100 p-2.5 rounded-xl"><CheckCheck size={20} className="text-purple-600" /></div>
          <h3 className="text-base font-semibold text-gray-900">Confirmation</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Annuler</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 text-sm font-medium text-white hover:bg-purple-700 transition-colors">Confirmer</button>
        </div>
      </div>
    </div>
  );
}

function DeliveryBanner({ orders, onStatusChange, cronStatus, onRefresh, refreshing }: {
  orders: Order[];
  onStatusChange: (id: string, status: DeliveryStatus) => void;
  cronStatus: { label: string; color: string; dot: string };
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [confirmOrder, setConfirmOrder] = useState(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deliveries = useMemo(() => {
    return orders
      .filter(o => o.expected_delivery_date && o.delivery_status !== 'collected')
      .map(o => {
        const date = new Date(o.expected_delivery_date!);
        date.setHours(0, 0, 0, 0);
        const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { order: o, date, diffDays };
      })
      .filter(d => d.diffDays >= -3 || d.order.delivery_status === 'available')
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 6);
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
  const lateCount     = deliveries.filter(d => d.diffDays < 0).length;
  const todayCount    = deliveries.filter(d => d.diffDays === 0).length;
  const upcomingCount = deliveries.filter(d => d.diffDays > 0).length;

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
        {deliveries.map(({ order, date, diffDays }) => {
          const status    = (order.delivery_status ?? 'pending') as DeliveryStatus;
          const statusCfg = STATUS_CONFIG[status];
          const urgency   = status === 'available'
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
                  <span className="text-xs text-gray-500">{fmt(date)}</span>
                </div>
                <span className="text-xs font-medium text-gray-500 flex-shrink-0">{urgency.text}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {status === 'pending' && (
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
                      <button onClick={(e) => { e.stopPropagation(); setConfirmOrder(order.id); }}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors">
                        <CheckCheck size={12} /><span className="hidden sm:inline">Récupéré</span>
                      </button>
                    </div>
                  )}
                  {isDone && status !== 'available' && (
                    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border}`}>
                      {statusCfg.label}
                    </span>
                  )}
                  {isDone && (
                    <button onClick={(e) => { e.stopPropagation(); onStatusChange(order.id, 'pending'); }}
                      className="text-xs text-gray-400 hover:text-gray-600 px-1" title="Réinitialiser">✕</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {confirmOrder && (
        <ConfirmModal
          message="Marquer ce colis comme récupéré ?"
          onConfirm={() => { onStatusChange(confirmOrder, "collected"); setConfirmOrder(null); }}
          onCancel={() => setConfirmOrder(null)}
        />
      )}
    </div>
  );
}

export function OrdersManager() {
  const { orders, loading, addOrder, deleteOrder, updateOrder, updateDeliveryStatus } = useOrders();
  const { status: cronStatus, refreshing, triggerRefresh } = useCronStatus();
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

  return (
    <div className="py-8 px-4 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mes Commandes</h1>
            <p className="text-gray-600 mt-1">Gérez toutes vos commandes en un seul endroit</p>
          </div>
          <button onClick={() => { setEditingOrder(null); setShowForm(true); }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            <Plus size={20} />Ajouter une commande
          </button>
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

        {!loading && <DeliveryBanner orders={orders} onStatusChange={updateDeliveryStatus} cronStatus={cronStatus} onRefresh={triggerRefresh} refreshing={refreshing} />}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            <p className="mt-4 text-gray-600">Chargement des commandes...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <OrdersList orders={orders} onEdit={handleEditOrder} onDelete={deleteOrder} isLoading={loading} onFilteredOrdersChange={setFilteredOrders} />
          </div>
        )}

        {showForm && (
          <OrderForm onSubmit={editingOrder ? handleUpdateOrder : handleAddOrder} onClose={handleCloseForm} initialData={editingOrder || undefined} isLoading={loading} />
        )}
      </div>
    </div>
  );
}