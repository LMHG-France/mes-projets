import { useState, useMemo } from 'react';
import { Plus, Euro, Package, ShoppingCart } from 'lucide-react';
import { useOrders, Order } from '../hooks/useOrders';
import { OrderForm } from './OrderForm';
import { OrdersList } from './OrdersList';

export function OrdersManager() {
  const { orders, loading, addOrder, deleteOrder, updateOrder } = useOrders();
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);

  const stats = useMemo(() => {
    // Utiliser filteredOrders seulement s'il a été initialisé (longueur > 0)
    // Sinon, utiliser orders pour l'affichage initial
    const ordersToUse = filteredOrders.length === 0 && orders.length > 0 ? orders : filteredOrders;
    const totalValue = ordersToUse.reduce((sum, order) => sum + order.total_price, 0);
    const totalUnits = ordersToUse.reduce((sum, order) =>
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    const totalOrders = ordersToUse.length;

    return { totalValue, totalUnits, totalOrders };
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

  const handleUpdateStatus = async (orderId: string, status: string | null) => {
    await updateOrder(orderId, { status });
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
            onClick={() => {
              setEditingOrder(null);
              setShowForm(true);
            }}
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
                <p className="text-2xl font-bold text-gray-900">{stats.totalValue.toFixed(2) €}
                  €</p>
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
              onUpdateStatus={handleUpdateStatus}
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
