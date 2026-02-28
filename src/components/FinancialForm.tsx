import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { MonthlyFinancial } from '../hooks/useFinancials';

interface FinancialFormProps {
  onSubmit: (data: Omit<MonthlyFinancial, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onClose: () => void;
  initialData?: MonthlyFinancial;
  isLoading?: boolean;
}

export function FinancialForm({ onSubmit, onClose, initialData, isLoading }: FinancialFormProps) {
  const [formData, setFormData] = useState({
    month: initialData?.month || new Date().toISOString().slice(0, 7) + '-01',
    amazon_stock_value: initialData?.amazon_stock_value || 0,
    pending_stock_value: initialData?.pending_stock_value || 0,
    amazon_funds: initialData?.amazon_funds || 0,
    bank_funds: initialData?.bank_funds || 0,
    supplier_credits: initialData?.supplier_credits || 0,
    revenue: initialData?.revenue || 0,
    profit: initialData?.profit || 0,
    notes: initialData?.notes || '',
  });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleNumberChange = (field: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: isNaN(numValue) ? 0 : numValue }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-gray-900">
            {initialData ? 'Modifier les données financières' : 'Ajouter des données financières'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mois <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              value={formData.month.slice(0, 7)}
              onChange={(e) => setFormData(prev => ({ ...prev, month: e.target.value + '-01' }))}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valeur de Stock Chez Amazon (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amazon_stock_value}
                onChange={(e) => handleNumberChange('amazon_stock_value', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valeur de Stock en Attente (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.pending_stock_value}
                onChange={(e) => handleNumberChange('pending_stock_value', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fonds en Attente Chez Amazon (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amazon_funds}
                onChange={(e) => handleNumberChange('amazon_funds', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fonds en Banque (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.bank_funds}
                onChange={(e) => handleNumberChange('bank_funds', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Avoirs Fournisseurs (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.supplier_credits}
                onChange={(e) => handleNumberChange('supplier_credits', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chiffre d'Affaire (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.revenue}
                onChange={(e) => handleNumberChange('revenue', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bénéfice (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.profit}
                onChange={(e) => handleNumberChange('profit', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ajoutez des notes optionnelles..."
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Enregistrement...' : initialData ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
