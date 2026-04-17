import { useState, useEffect } from 'react';
import { X, Package, Clock, Building2, BadgePercent, TrendingUp, DollarSign, CalendarDays, FileText, CreditCard, Wallet, ChevronDown } from 'lucide-react';
import { MonthlyFinancial } from '../hooks/useFinancials';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

interface FinancialFormProps {
  onSubmit: (data: Omit<MonthlyFinancial, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
  initialData?: MonthlyFinancial;
  isLoading?: boolean;
}

export function FinancialForm({ onSubmit, onClose, initialData, isLoading }: FinancialFormProps) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());
  const [formData, setFormData] = useState({
    revenue:             '',
    amazon_stock_value:  '',
    pending_stock_value: '',
    amazon_funds:        '',
    bank_funds:          '',
    supplier_credits:    '',
    debts:               '',
    notes:               '',
  });

  useEffect(() => {
    if (initialData) {
      const d = new Date(initialData.month);
      setSelectedMonth(d.getMonth());
      setSelectedYear(d.getFullYear());
      setFormData({
        revenue:             String(initialData.revenue             ?? ''),
        amazon_stock_value:  String(initialData.amazon_stock_value  ?? ''),
        pending_stock_value: String(initialData.pending_stock_value ?? ''),
        amazon_funds:        String(initialData.amazon_funds        ?? ''),
        bank_funds:          String(initialData.bank_funds          ?? ''),
        supplier_credits:    String(initialData.supplier_credits    ?? ''),
        debts:               String((initialData as any).debts      ?? ''),
        notes:               initialData.notes ?? '',
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ── Calculs automatiques ─────────────────────────────────
  const stockAmazon  = parseFloat(formData.amazon_stock_value)  || 0;
  const stockAttente = parseFloat(formData.pending_stock_value) || 0;
  const fondsAmazon  = parseFloat(formData.amazon_funds)        || 0;
  const fondsBanque  = parseFloat(formData.bank_funds)          || 0;
  const dettes       = parseFloat(formData.debts)               || 0;

  const supplierCredits = parseFloat(formData.supplier_credits) || 0;

  // Liquidité = somme des 5 actifs (dont avoirs fournisseurs)
  const computedLiquidity = stockAmazon + stockAttente + fondsAmazon + fondsBanque + supplierCredits;
  // Bénéfice = Liquidité - Dettes (le delta vs mois précédent est calculé dans FinancialTracker)
  const computedProfit = computedLiquidity - dettes;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mm = String(selectedMonth + 1).padStart(2, '0');
    const monthStr = `${selectedYear}-${mm}-01`;
    onSubmit({
      month:               monthStr,
      revenue:             parseFloat(formData.revenue) || 0,
      profit:              computedProfit,
      amazon_stock_value:  stockAmazon,
      pending_stock_value: stockAttente,
      amazon_funds:        fondsAmazon,
      bank_funds:          fondsBanque,
      supplier_credits:    supplierCredits,
      debts:               dettes,
      notes:               formData.notes,
    } as any);
  };

  const fieldPairs = [
    [
      { name: 'amazon_stock_value',  label: 'Stock Chez Amazon',   icon: <Package      size={16} className="text-orange-500" /> },
      { name: 'pending_stock_value', label: 'Stock en Attente',    icon: <Clock        size={16} className="text-yellow-500" /> },
    ],
    [
      { name: 'amazon_funds',        label: 'Fonds Amazon',         icon: <DollarSign   size={16} className="text-purple-500" /> },
      { name: 'bank_funds',          label: 'Fonds en Banque',      icon: <Building2    size={16} className="text-teal-500"   /> },
    ],
    [
      { name: 'supplier_credits',    label: 'Avoirs Fournisseurs',  icon: <BadgePercent size={16} className="text-pink-500"   /> },
      { name: 'debts',               label: 'Dettes',               icon: <CreditCard   size={16} className="text-red-500"    /> },
    ],
  ];

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-none w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {initialData ? 'Modifier le mois' : 'Ajouter un mois'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Renseignez vos données financières mensuelles</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Mois */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 dark:text-gray-700 mb-1.5">
              <CalendarDays size={16} className="text-gray-400 dark:text-gray-600" /> Mois
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Dropdown mois */}
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="appearance-none w-full border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-2.5 text-sm text-gray-700 dark:text-gray-300 dark:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white dark:bg-gray-800"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 pointer-events-none" />
              </div>
              {/* Dropdown année */}
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="appearance-none w-full border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-2.5 text-sm text-gray-700 dark:text-gray-300 dark:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white dark:bg-gray-800"
                >
                  {YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Chiffre d'Affaires */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 dark:text-gray-700 mb-1.5">
              <TrendingUp size={16} className="text-green-500" /> Chiffre d'Affaires (€)
            </label>
            <div className="relative">
              <input
                type="number" name="revenue" value={formData.revenue}
                onChange={handleChange} placeholder="0.00" step="0.01" min="0"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 text-sm font-medium">€</span>
            </div>
          </div>

          {/* Stocks & Trésorerie */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-1">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-3">Stocks & Trésorerie</p>
            <div className="space-y-3">
              {fieldPairs.map((pair, pi) => (
                <div key={pi} className="grid grid-cols-2 gap-3">
                  {pair.map(field => (
                    <div key={field.name}>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 dark:text-gray-700 mb-1.5">
                        {field.icon} {field.label} (€)
                      </label>
                      <div className="relative">
                        <input
                          type="number" name={field.name}
                          value={formData[field.name as keyof typeof formData]}
                          onChange={handleChange} placeholder="0.00" step="0.01" min="0"
                          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 text-xs font-medium">€</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Liquidité Totale calculée */}
          <div className="rounded-xl p-4 border bg-sky-50 border-sky-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet size={13} className="text-sky-500" /> Liquidité Totale calculée
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                  Stock Amazon + Stock Attente + Fonds Amazon + Fonds Banque + Avoirs Fourn.
                </p>
              </div>
              <p className="text-xl font-bold text-sky-600">
                {formatCurrency(computedLiquidity)}
              </p>
            </div>
          </div>

          {/* Bénéfice net calculé */}
          <div className={`rounded-xl p-4 border ${computedProfit >= 0 ? 'bg-blue-50 dark:bg-blue-950 border-blue-100' : 'bg-red-50 dark:bg-red-950 border-red-100'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Bénéfice net calculé</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                  Liquidité Totale − Dettes
                </p>
              </div>
              <p className={`text-xl font-bold ${computedProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(computedProfit)}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 dark:text-gray-700 mb-1.5">
              <FileText size={16} className="text-gray-400 dark:text-gray-600" /> Notes (optionnel)
            </label>
            <textarea
              name="notes" value={formData.notes} onChange={handleChange}
              placeholder="Remarques, événements du mois..." rows={2}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 dark:text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors text-sm">
              Annuler
            </button>
            <button type="submit" disabled={isLoading}
              className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? 'Enregistrement...' : initialData ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}