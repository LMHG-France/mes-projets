import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface StockItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  source_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useStock() {
  const { user } = useAuth();
  const [items, setItems]     = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('stock_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setItems([]); setLoading(false); return; }
    fetchItems();
    const ch = supabase.channel('stock_items_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items', filter: `user_id=eq.${user.id}` }, (p) => {
        if (p.eventType === 'INSERT') setItems(prev => [p.new as StockItem, ...prev]);
        if (p.eventType === 'UPDATE') setItems(prev => prev.map(i => i.id === p.new.id ? p.new as StockItem : i));
        if (p.eventType === 'DELETE') setItems(prev => prev.filter(i => i.id !== p.old.id));
      }).subscribe();
    return () => { ch.unsubscribe(); };
  }, [user, fetchItems]);

  const addItem = async (data: { name: string; quantity: number; unit_price: number; source_order_id?: string | null }) => {
    if (!user) return;
    // Si item avec même nom existe déjà → additionner la quantité
    const existing = items.find(i => i.name.toLowerCase().trim() === data.name.toLowerCase().trim());
    if (existing) {
      await supabase.from('stock_items')
        .update({ quantity: existing.quantity + data.quantity, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('stock_items').insert({ ...data, user_id: user.id });
    }
  };

  const addFromOrder = async (orderItems: { name: string; quantity: number; pricePerUnit: number; price_ttc?: number }[], orderId: string) => {
    for (const item of orderItems) {
      await addItem({
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price_ttc ?? item.pricePerUnit,
        source_order_id: orderId,
      });
    }
  };

  const updateItem = async (id: string, data: Partial<Pick<StockItem, 'name' | 'quantity' | 'unit_price'>>) => {
    await supabase.from('stock_items').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const deleteItem = async (id: string) => {
    await supabase.from('stock_items').delete().eq('id', id);
  };

  const totalValue = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  return { items, loading, addItem, addFromOrder, updateItem, deleteItem, totalValue, totalUnits };
}