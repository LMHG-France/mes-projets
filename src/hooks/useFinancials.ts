import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface MonthlyFinancial {
  id: string;
  user_id: string;
  month: string;
  amazon_stock_value: number;
  pending_stock_value: number;
  amazon_funds: number;
  bank_funds: number;
  supplier_credits: number;
  revenue: number;
  profit: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useFinancials() {
  const { user } = useAuth();
  const [financials, setFinancials] = useState<MonthlyFinancial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFinancials();
    }
  }, [user]);

  const fetchFinancials = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('monthly_financials')
        .select('*')
        .order('month', { ascending: false });

      if (error) throw error;
      setFinancials(data || []);
    } catch (error) {
      console.error('Error fetching financials:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFinancial = async (financial: Omit<MonthlyFinancial, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('monthly_financials')
        .insert([{ ...financial, user_id: user!.id }])
        .select()
        .single();

      if (error) throw error;
      setFinancials([data, ...financials]);
      return data;
    } catch (error) {
      console.error('Error adding financial:', error);
      throw error;
    }
  };

  const updateFinancial = async (id: string, updates: Partial<Omit<MonthlyFinancial, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('monthly_financials')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setFinancials(financials.map(f => f.id === id ? data : f));
      return data;
    } catch (error) {
      console.error('Error updating financial:', error);
      throw error;
    }
  };

  const deleteFinancial = async (id: string) => {
    try {
      const { error } = await supabase
        .from('monthly_financials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setFinancials(financials.filter(f => f.id !== id));
    } catch (error) {
      console.error('Error deleting financial:', error);
      throw error;
    }
  };

  return {
    financials,
    loading,
    addFinancial,
    updateFinancial,
    deleteFinancial,
    refreshFinancials: fetchFinancials,
  };
}
