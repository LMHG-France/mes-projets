import { useState, useEffect } from 'react';
import { X, Package, Clock, Wallet, Building2, BadgePercent, TrendingUp, DollarSign, CalendarDays, FileText } from 'lucide-react';
import { MonthlyFinancial } from '../hooks/useFinancials';

interface FinancialFormProps {
  onSubmit: (data: Omit<MonthlyFinancial, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
  initialData?: MonthlyFinancial;
  isLoading?: boolean;
}

export function FinancialForm({ onSubmit, onClose, initialData, isLoading }: FinancialFormProps) {
  const [formData, setFormData] = useState({
    month: '',
    revenue: '',
    profit: '',
    amazon_stock_value: '',
    pending_stock_value: '',
    amazon_funds: '',
    bank_funds: '',
    supplier_credits: '',
    notes: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        month: initialData.month?.slice(0, 7) ?? '',
        revenue: String(initialData.revenue ?? ''),
        profit: String(initialData.profit ?? ''),
        amazon_stock_value: String(initialData.amazon_stock_value ?? ''),
        pending_stock_value: String(initialData.pending_stock_value ?? ''),
        amazon_funds: String(initialData.amazon_funds ?? ''),
        bank_funds: String(initialData.bank_funds ?? ''),
        supplier_credits: String(initialData.supplier_credits ?? ''),
        notes: initialData.notes ?? '',
      });
    } else {
      // Pré-remplir avec le mois courant
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      setFormData(prev => ({ ...prev, month: `${yyyy}-${mm}` }));
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      month: formData.month + '-01',
      revenue: parseFloat(formData.revenue) || 0,
      profit: parseFloat(formData.profit) || 0,
      amazon_stock_value: parseFloat(formData.amazon_stock_value) || 0,
      pending_stock_value: parseFloat(formData.pending_stock_value) || 0,
      amazon_funds: parseFloat(formData.amazon_funds) || 0,
      bank_funds: parseFloat(formData.bank_funds) || 0,
      supplier_credits: parseFloat(formData.supplier_credits) || 0,
      notes: formData.notes,
    });
  };

  const fields = [
    {
      name: 'amazon_stock_value',
      label: 'Valeur Stock Chez Amazon',
      icon: <Package size={18} className="text-orange-500" />,
      placeholder: '0.00',
      color: 'orange',
    },
    {
      name: 'pending_stock_value',
      label: 'Valeur Stock en Attente',
      icon: <Clock size={18} className="text-yellow-500" />,
      placeholder: '0.00',
      color: 'yellow',
    },
    {
      name: 'amazon_funds',
      label: 'Fond en Attente (Amazon)',
      icon: <DollarSign size={18} className="text-blue-500" />,
      placeholder: '0.00',
      color: 'blue',
    },
    {
      name: 'bank_funds',
      label: 'Fond en Banque',
      icon: <Building2 size={18} className="text-teal-500" />,
      placeholder: '0.00',
      color: 'teal',
    },
    {
      name: 'supplier_credits',
      label: 'Avoir Fournisseurs',
      icon: <BadgePercent size={18} className="text-purple-500" />,
      placeholder: '0.00',
      color: 'purple',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {initialData ? 'Modifier le mois' : 'Ajouter un mois'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Renseignez vos données financières mensuelles</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Mois */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
              <CalendarDays size={16} className="text-gray-400" />
              Mois
            </label>
            <input
              type="month"
              name="month"
              value={formData.month}
              onChange={handleChange}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* CA et Bénéfice */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                <TrendingUp size={16} className="text-green-500" />
                Chiffre d'Affaires (€)
              </label>
              <input
                type="number"
                name="revenue"
                value={formData.revenue}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                <Wallet size={16} className="text-blue-500" />
                Bénéfice (€)
              </label>
              <input
                type="number"
                name="profit"
                value={formData.profit}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Séparateur */}
          <div className="border-t border-gray-100 pt-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Stocks & Trésorerie</p>

            {/* Champs principaux */}
            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.name}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                    {field.icon}
                    {field.label} (€)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name={field.name}
                      value={formData[field.name as keyof typeof formData]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      step="0.01"
                      min="0"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">€</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
              <FileText size={16} className="text-gray-400" />
              Notes (optionnel)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Remarques, événements du mois..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Enregistrement...' : initialData ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}