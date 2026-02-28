import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface OrderItem {
  name: string;
  quantity: number;
  pricePerUnit: number;
  priceInput?: string;
  price_ht?: number;
  price_ttc?: number;
}

export interface Order {
  id: string;
  supplier_name: string;
  items: OrderItem[];
  total_price: number;
  tracking_link: string | null;
  expected_delivery_date: string | null;
  created_at: string;
  updated_at: string;
}

export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    fetchOrders();

    const channel = supabase
      .channel('orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Gestion optimiste : on met à jour seulement si nécessaire
          if (payload.eventType === 'INSERT') {
            setOrders(prev => {
              const exists = prev.some(order => order.id === payload.new.id);
              if (exists) return prev;
              return [payload.new as Order, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setOrders(prev =>
              prev.map(order => order.id === payload.new.id ? payload.new as Order : order)
            );
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(order => order.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setOrders(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addOrder = async (orderData: Omit<Order, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Préparer les données à insérer
      const insertData: any = {
        user_id: user.id,
        supplier_name: orderData.supplier_name,
        items: orderData.items,
        total_price: orderData.total_price,
        tracking_link: orderData.tracking_link,
      };

      // Ajouter expected_delivery_date seulement s'il est fourni
      if (orderData.expected_delivery_date) {
        insertData.expected_delivery_date = orderData.expected_delivery_date;
      }

      const { data, error: err } = await supabase
        .from('orders')
        .insert(insertData)
        .select()
        .single();

      if (err) {
        console.error('Error adding order:', err);
        throw err;
      }

      // Ajouter immédiatement la nouvelle commande à la liste
      if (data) {
        setOrders(prevOrders => [data, ...prevOrders]);
      }
    } catch (err) {
      console.error('Exception in addOrder:', err);
      throw err instanceof Error ? err : new Error('Failed to add order');
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      const { error: err } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (err) throw err;

      // Retirer immédiatement la commande de la liste
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete order');
    }
  };

  const updateOrder = async (orderId: string, orderData: Partial<Omit<Order, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error: err } = await supabase
        .from('orders')
        .update(orderData)
        .eq('id', orderId)
        .select()
        .single();

      if (err) throw err;

      // Mettre à jour immédiatement la commande dans la liste
      if (data) {
        setOrders(prevOrders =>
          prevOrders.map(order => order.id === orderId ? data : order)
        );
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update order');
    }
  };

  return { orders, loading, error, addOrder, deleteOrder, updateOrder };
}
