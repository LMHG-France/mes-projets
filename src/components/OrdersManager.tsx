import { useState, useMemo } from 'react';
import { Plus, Euro, Package, ShoppingCart, Truck, CalendarClock } from 'lucide-react';
import { useOrders, Order } from '../hooks/useOrders';
import { OrderForm } from './OrderForm';
import { OrdersList } from './OrdersList';

function DeliveryBanner({ orders }: { orders: Order[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deliveries = useMemo(() => {
    return orders
      .filter(o => o.expected_delivery_date)
      .map(o => {
        const date = new Date(o.expected_delivery_date!);
        date.setHours(0, 0, 0, 0);
        const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { order: o, date, diffDays };
      })
      .filter(d => d.diffDays >= -1)
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 5);
  }, [orders]);

  if (deliveries.length === 0) return null;

  const getLabel = (diffDays: number) => {
    if (diffDays < 0)   return { text: 'En retard',         color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500' };
    if (diffDays === 0) return { text: "Aujourd'hui",        color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500' };
    if (diffDays === 1) return { text: 'Demain',             color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500' };
    if (diffDays <= 3)  return { text: `Dans ${diffDays}j`,  color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-400' };
    return               { text: `Dans ${diffDays}j`,        color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-400' };
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  const todayCount    = deliveries.filter(d => d.diffDays === 0).length;
  const lateCount     = deliveries.filter(d => d.diffDays < 0).length;
  const upcomingCount = deliveries.filter(d => d.diffDays > 0).length;

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600">
        <Truck size={18} className="text-white" />
        <span className="text-white font-semibold text-sm">Livraisons à venir</span>
        <div className="ml-auto flex items-center gap-3 text-xs text-blue-100">
          {lateCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              {lateCount} en retard
            </span>
          )}
          {todayCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              {todayCount} aujourd'hui
            </span>
          )}
          {upcomingCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-300 inline-block" />
              {upcomingCount} à venir
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {deliveries.map(({ order, date, diffDays }) => {
          const label    = getLabel(diffDays);
          const firstItem = order.items?.[0];
          const itemCount = order.items?.length ?? 0;

          return (
            <div key={order.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${label.dot}`} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{order.supplier_name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {firstItem ? `${firstItem.quantity}x ${firstItem.name}` : '—'}
                  {itemCount > 1 && ` +${itemCount - 1} autre${itemCount > 2 ? 's' : ''}`}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <CalendarClock size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">{formatDate(date)}</span>
              </div>

              <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${label.color} ${label.bg} ${label.border}`}>
                {label.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrdersManager() {
  const { orders, loading, addOrder, deleteOrder, updateOrder } = useOrders();
  const [showForm, setShowForm]       = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);

  const stats = useMemo(() => {
    const ordersToUse = filteredOrders.length === 0 && orders.length > 0 ? orders : filteredOrders;
    const totalValue  = ordersToUse.reduce((sum, order) => sum + order.total_price, 0);
    const totalUnits  = ordersToUse.reduce((sum, order) =>
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    return { totalValue, totalUnits, totalOrders: ordersToUse.length };
  }, [orders, filteredOrders]);

  const handleAddOrder = async (orderData: Omit<Order, 'id' | 'created_at' | 'updated_at'>) => {
    await addOrder(orderData);
    setShowForm(false);
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setShowForm(true);
  };

  const handleUpdateOrder = async (orderData: Omit<Order, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingOrder) {
      await updateOrder(editingOrder.id, orderData);
      setEditingOrder(null);
      setShowForm(false);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingOrder(null);
  };

  return (
    <div className="py-8 px-4 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mes Commandes</h1>
            <p className="text-gray-600 mt-1">Gérez toutes vos commandes en un seul endroit</p>
          </div>
          <button
            onClick={() => { setEditingOrder(null); setShowForm(true); }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Ajouter une commande
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Euro className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Valeur totale</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalValue.toFixed(2)} €</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 p-3 rounded-lg">
                <Package className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Unités totales</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUnits}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-orange-100 p-3 rounded-lg">
                <ShoppingCart className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Nombre de commandes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
              </div>
            </div>
          </div>
        </div>

        {!loading && <DeliveryBanner orders={orders} />}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement des commandes...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <OrdersList
              orders={orders}
              onEdit={handleEditOrder}
              onDelete={deleteOrder}
              isLoading={loading}
              onFilteredOrdersChange={setFilteredOrders}
            />
          </div>
        )}

        {showForm && (
          <OrderForm
            onSubmit={editingOrder ? handleUpdateOrder : handleAddOrder}
            onClose={handleCloseForm}
            initialData={editingOrder || undefined}
            isLoading={loading}
          />
        )}
      </div>
    </div>
  );
}