import { useEffect, useState, useCallback } from 'react';
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

export type DeliveryStatus = 'pending' | 'delivered' | 'available' | 'collected';

export interface Order {
  id: string;
  supplier_name: string;
  items: OrderItem[];
  total_price: number;
  tracking_link: string | null;
  order_link: string | null;
  expected_delivery_date: string | null;
  delivery_status: DeliveryStatus;
  delivery_type: string | null;
  hidden_in_orders: boolean;
  created_at: string;
  updated_at: string;
}

// Envoie le lien de tracking à AfterShip via l'edge function
// Appelé à la création d'une commande ET lors du refresh manuel/auto
export async function callAfterShip(orderId: string, trackingLink: string): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    const res = await fetch(`${url}/functions/v1/extract_delivery_date`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ order_id: orderId, tracking_url: trackingLink }),
    });
    if (!res.ok) console.error(`AfterShip error for order ${orderId}: HTTP ${res.status}`);
    else console.log(`AfterShip OK for order ${orderId}`);
  } catch (e) {
    console.error(`AfterShip fetch error for order ${orderId}:`, e);
  }
}

export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (includeHidden = false) => {
    if (!user) return;
    try {
      setLoading(true);
      let query = supabase
        .from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!includeHidden) query = query.eq('hidden_in_orders', false);
      const { data, error: err } = await query;
      if (err) throw err;
      setOrders(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) { setOrders([]); setLoading(false); return; }
    fetchOrders();

    const pollInterval = setInterval(() => { fetchOrders(); }, 3 * 60 * 1000);

    const channel = supabase
      .channel('orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setOrders(prev => {
              const exists = prev.some(o => o.id === payload.new.id);
              if (exists) return prev;
              return [payload.new as Order, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.hidden_in_orders) {
              setOrders(prev => prev.filter(o => o.id !== payload.new.id));
            } else {
              setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as Order : o));
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id));
          }
        }
      ).subscribe();

    return () => { clearInterval(pollInterval); channel.unsubscribe(); };
  }, [user]);

  const addOrder = async (orderData: Omit<Order, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      const insertData: any = {
        user_id: user.id,
        supplier_name: orderData.supplier_name,
        items: orderData.items,
        total_price: orderData.total_price,
        tracking_link: orderData.tracking_link,
        order_link: orderData.order_link ?? null,
        delivery_status: orderData.delivery_status ?? 'pending',
      };
      if (orderData.expected_delivery_date) insertData.expected_delivery_date = orderData.expected_delivery_date;
      const { data, error: err } = await supabase.from('orders').insert(insertData).select().single();
      if (err) throw err;
      if (data) {
        setOrders(prev => [data, ...prev]);
        // Envoyer immédiatement à AfterShip si un lien de tracking est fourni
        if (data.tracking_link) {
          console.log(`[addOrder] Envoi à AfterShip pour la commande ${data.id}`);
          callAfterShip(data.id, data.tracking_link); // fire-and-forget, ne bloque pas l'UI
        }
      }
    } catch (err) { throw err instanceof Error ? err : new Error('Failed to add order'); }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      const { error: err } = await supabase.from('orders').update({ hidden_in_orders: true }).eq('id', orderId);
      if (err) throw err;
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) { throw err instanceof Error ? err : new Error('Failed to delete order'); }
  };

  const updateOrder = async (orderId: string, orderData: Partial<Omit<Order, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error: err } = await supabase.from('orders').update(orderData).eq('id', orderId).select().single();
      if (err) throw err;
      if (data) setOrders(prev => prev.map(o => o.id === orderId ? data : o));
    } catch (err) { throw err instanceof Error ? err : new Error('Failed to update order'); }
  };

  const updateDeliveryStatus = async (orderId: string, status: DeliveryStatus) => {
    await updateOrder(orderId, { delivery_status: status });
  };

  return { orders, loading, error, addOrder, deleteOrder, updateOrder, updateDeliveryStatus, fetchOrders };
}