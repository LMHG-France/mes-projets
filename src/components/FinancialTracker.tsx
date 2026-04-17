import { useState, useMemo } from 'react';
import {
  Plus, TrendingUp, TrendingDown, DollarSign, Edit2, Trash2,
  Package, Clock, Building2, BadgePercent, BarChart2, ChevronDown, CreditCard
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useFinancials, MonthlyFinancial } from '../hooks/useFinancials';
import { FinancialForm } from './FinancialForm';

// ── Métriques ────────────────────────────────────────────────
const METRICS = [
  { key: 'revenue',             label: "Chiffre d'Affaires", color: '#22c55e' },
  { key: 'profit',              label: 'Bénéfice',           color: '#3b82f6' },
  { key: 'total_liquidity',     label: 'Liquidité Totale',   color: '#0ea5e9' },
  { key: 'amazon_stock_value',  label: 'Stock Amazon',       color: '#f97316' },
  { key: 'pending_stock_value', label: 'Stock en Attente',   color: '#eab308' },
  { key: 'amazon_funds',        label: 'Fonds Amazon',       color: '#8b5cf6' },
  { key: 'bank_funds',          label: 'Fonds en Banque',    color: '#14b8a6' },
  { key: 'supplier_credits',    label: 'Avoirs Fournisseurs',color: '#ec4899' },
  { key: 'debts',               label: 'Dettes',             color: '#ef4444' },
] as const;

type MetricKey = typeof METRICS[number]['key'] | 'all';

type RangeKey = '3m' | '6m' | '12m' | 'prev_month' | 'current_year' | 'all' | 'custom';

const RANGE_OPTIONS: { label: string; value: RangeKey }[] = [
  { label: '3 derniers mois',    value: '3m'           },
  { label: '6 derniers mois',    value: '6m'           },
  { label: '12 derniers mois',   value: '12m'          },
  { label: 'Mois précédent',     value: 'prev_month'   },
  { label: 'Année en cours',     value: 'current_year' },
  { label: 'Tout',               value: 'all'          },
  { label: 'Date personnalisée', value: 'custom'       },
];

// ── Helpers ──────────────────────────────────────────────────
const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €';

const formatMonth = (dateString: string) =>
  new Date(dateString).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

const formatMonthShort = (dateString: string) =>
  new Date(dateString).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

// Liquidité = Stock Amazon + Stock Attente + Fonds Amazon + Fonds Banque + Avoirs Fournisseurs
function getLiquidityTotal(f: MonthlyFinancial): number {
  return f.amazon_stock_value + f.pending_stock_value + f.amazon_funds + f.bank_funds + f.supplier_credits;
}

// Position nette = Liquidité - Dettes
function getNetPosition(f: MonthlyFinancial): number {
  return getLiquidityTotal(f) - ((f as any).debts ?? 0);
}

// Bénéfice mensuel = Position nette mois courant - Position nette mois précédent
// Pour le premier mois enregistré : on retourne la position nette directement
function computeProfit(current: MonthlyFinancial, previous: MonthlyFinancial | null): number {
  const currentNet = getNetPosition(current);
  if (!previous) return currentNet;
  return currentNet - getNetPosition(previous);
}

function getMetricValue(
  f: MonthlyFinancial,
  key: string,
  previous: MonthlyFinancial | null
): number {
  if (key === 'total_liquidity') return getLiquidityTotal(f);
  if (key === 'profit')          return computeProfit(f, previous);
  return ((f as any)[key] as number) ?? 0;
}

function filterByRange(
  financials: MonthlyFinancial[],
  range: RangeKey,
  customStart: string,
  customEnd: string
): MonthlyFinancial[] {
  const sorted = [...financials].sort(
    (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()
  );
  const now = new Date();

  if (range === '3m')  return sorted.slice(-3);
  if (range === '6m')  return sorted.slice(-6);
  if (range === '12m') return sorted.slice(-12);
  if (range === 'all') return sorted;

  if (range === 'prev_month') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return sorted.filter(f => {
      const d = new Date(f.month);
      return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
    });
  }

  if (range === 'current_year') {
    return sorted.filter(f => new Date(f.month).getFullYear() === now.getFullYear());
  }

  if (range === 'custom' && customStart && customEnd) {
    const start = new Date(customStart + '-01');
    const end   = new Date(customEnd   + '-01');
    return sorted.filter(f => {
      const d = new Date(f.month);
      return d >= start && d <= end;
    });
  }

  return sorted;
}

// ── Tooltip ──────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, isAll }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-850 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg dark:shadow-none px-4 py-3 min-w-[180px]">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 capitalize">{label}</p>
      {isAll ? (
        payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
            <span className="text-xs font-medium" style={{ color: p.color }}>{p.name}</span>
            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{formatCurrency(p.value)}</span>
          </div>
        ))
      ) : (
        <>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(payload[0].value)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-400">{payload[0].name}</p>
        </>
      )}
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────
export function FinancialTracker() {
  const { theme } = useTheme();
  const { financials, loading, addFinancial, updateFinancial, deleteFinancial } = useFinancials();
  const [showForm, setShowForm]                 = useState(false);
  const [editingFinancial, setEditingFinancial] = useState<MonthlyFinancial | null>(null);
  const [deletingId, setDeletingId]             = useState<string | null>(null);
  const [activeMetric, setActiveMetric]         = useState<MetricKey>('revenue');
  const [activeRange, setActiveRange]           = useState<RangeKey>('6m');
  const [customStart, setCustomStart]           = useState('');
  const [customEnd, setCustomEnd]               = useState('');

  const isCustom     = activeRange === 'custom';
  const isAllMetrics = activeMetric === 'all';

  // Tous les mois triés (pour retrouver le mois précédent)
  const allSorted = useMemo(() =>
    [...financials].sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()),
    [financials]
  );

  const filteredData = useMemo(
    () => filterByRange(financials, activeRange, customStart, customEnd),
    [financials, activeRange, customStart, customEnd]
  );

  // Construit les données graphique en passant le mois précédent pour le calcul du bénéfice
  const chartData = useMemo(() =>
    filteredData.map(f => {
      const idx      = allSorted.findIndex(x => x.id === f.id);
      const previous = idx > 0 ? allSorted[idx - 1] : null;
      const point: Record<string, any> = { month: formatMonthShort(f.month) };
      METRICS.forEach(m => { point[m.key] = getMetricValue(f, m.key, previous); });
      return point;
    }),
    [filteredData, allSorted]
  );

  const evolution = useMemo(() => {
    if (isAllMetrics || chartData.length < 2) return null;
    const key   = activeMetric as string;
    const first = chartData[0][key];
    const last  = chartData[chartData.length - 1][key];
    if (first === 0) return null;
    return ((last - first) / Math.abs(first)) * 100;
  }, [chartData, activeMetric, isAllMetrics]);

  const currentMetric = METRICS.find(m => m.key === activeMetric);

  // Somme des valeurs du graphique sur la période filtrée
  const chartSum = useMemo(() => {
    if (isAllMetrics || chartData.length === 0) return null;
    const key = activeMetric as string;
    return chartData.reduce((sum: number, point: any) => sum + (point[key] ?? 0), 0);
  }, [chartData, activeMetric, isAllMetrics]);

  const handleAddFinancial = async (data: Omit<MonthlyFinancial, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try { await addFinancial(data); setShowForm(false); }
    catch { alert("Erreur lors de l'ajout des données financières"); }
  };

  const handleUpdateFinancial = async (data: Omit<MonthlyFinancial, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!editingFinancial) return;
    try {
      await updateFinancial(editingFinancial.id, data);
      setEditingFinancial(null);
      setShowForm(false);
    } catch { alert('Erreur lors de la mise à jour'); }
  };

  const handleEdit   = (f: MonthlyFinancial) => { setEditingFinancial(f); setShowForm(true); };
  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ces données ?')) return;
    try { setDeletingId(id); await deleteFinancial(id); }
    catch { alert('Erreur lors de la suppression'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="py-8 px-4 lg:px-8 min-h-screen" style={{ background: theme === 'dark' ? '#0f172a' : '#f4f6fb' }}>
      <div className="max-w-7xl mx-auto space-y-8">

        {/* En-tête */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Suivi Financier</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Gérez vos performances financières mensuelles</p>
          </div>
          <button
            onClick={() => { setEditingFinancial(null); setShowForm(true); }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm dark:shadow-none"
          >
            <Plus size={20} /> Ajouter un mois
          </button>
        </div>

        {/* Graphique */}
        <div className="bg-white dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm dark:shadow-none p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <BarChart2 size={20} className="text-gray-400 dark:text-gray-400 shrink-0" />
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                {isAllMetrics ? 'Évolution — Toutes les métriques' : `Évolution — ${currentMetric?.label}`}
              </h2>
              {!isAllMetrics && evolution !== null && (
                <span className={`inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full ${
                  evolution >= 0 ? 'bg-green-50 dark:bg-green-950 text-green-700' : 'bg-red-50 dark:bg-red-950 text-red-600'
                }`}>
                  {evolution >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {evolution >= 0 ? '+' : ''}{evolution.toFixed(1)}%
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <select
                  value={activeRange}
                  onChange={e => setActiveRange(e.target.value as RangeKey)}
                  className="appearance-none bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 dark:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {RANGE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value} className="text-gray-900 dark:text-gray-100">{r.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={activeMetric}
                  onChange={e => setActiveMetric(e.target.value as MetricKey)}
                  className="appearance-none bg-white dark:bg-gray-850 rounded-lg pl-3 pr-8 py-2 text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer border-2"
                  style={{ borderColor: isAllMetrics ? '#6b7280' : (currentMetric?.color ?? '#6b7280') }}
                >
                  <option value="all" className="text-gray-900 dark:text-gray-100">Tout</option>
                  {METRICS.map(m => (
                    <option key={m.key} value={m.key} className="text-gray-900 dark:text-gray-100">{m.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {isCustom && (
            <div className="flex flex-wrap items-center gap-3 mb-5 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 dark:text-gray-400">Période :</span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">Du</label>
                <input type="month" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 dark:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-850" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">Au</label>
                <input type="month" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 dark:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-850" />
              </div>
            </div>
          )}

          {chartData.length < 1 ? (
            <div className="h-52 flex flex-col items-center justify-center gap-3">
              <BarChart2 size={44} className="text-gray-200" />
              <p className="text-sm text-gray-400 dark:text-gray-400">
                {isCustom && (!customStart || !customEnd) ? 'Sélectionnez une plage de dates' : 'Pas de données sur cette période'}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={isAllMetrics ? 280 : 230}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {METRICS.map(m => (
                    <linearGradient key={m.key} id={`grad_${m.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={m.color} stopOpacity={isAllMetrics ? 0.08 : 0.18} />
                      <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v) + '€'}
                  tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={65}
                />
                <Tooltip content={<CustomTooltip isAll={isAllMetrics} />} />
                {isAllMetrics && (
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                    formatter={(value) => {
                      const m = METRICS.find(m => m.key === value);
                      return <span style={{ color: '#6b7280' }}>{m?.label ?? value}</span>;
                    }}
                  />
                )}
                {isAllMetrics
                  ? METRICS.map(m => (
                      <Area key={m.key} type="monotone" dataKey={m.key} name={m.key}
                        stroke={m.color} strokeWidth={1.5} fill={`url(#grad_${m.key})`} dot={false} />
                    ))
                  : currentMetric && (
                      <Area type="monotone" dataKey={currentMetric.key} name={currentMetric.label}
                        stroke={currentMetric.color} strokeWidth={2.5} fill={`url(#grad_${currentMetric.key})`}
                        dot={{ r: 4, fill: currentMetric.color, strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    )
                }
              </AreaChart>
            </ResponsiveContainer>
          )}

        {/* Case somme de la période */}
        {chartSum !== null && chartData.length > 0 && (
          <div
            className="bg-white dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm dark:shadow-none px-6 py-4 flex items-center justify-between"
            style={{ borderLeft: `4px solid ${currentMetric?.color ?? '#6b7280'}` }}
          >
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                Total — {currentMetric?.label}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">
                Somme sur la période sélectionnée ({chartData.length} mois)
              </p>
            </div>
            <p className="text-2xl font-bold" style={{ color: currentMetric?.color ?? '#6b7280' }}>
              {formatCurrency(chartSum)}
            </p>
          </div>
        )}
        </div>

        {/* Liste des mois */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Chargement...</p>
          </div>
        ) : financials.length === 0 ? (
          <div className="bg-white dark:bg-gray-850 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-2xl mb-4">
              <TrendingUp size={32} className="text-blue-400" />
            </div>
            <p className="text-gray-700 dark:text-gray-300 dark:text-gray-700 font-medium text-lg mb-1">Aucune donnée financière</p>
            <p className="text-gray-400 dark:text-gray-400 text-sm mb-6">Commencez par ajouter votre premier mois</p>
            <button
              onClick={() => { setEditingFinancial(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus size={16} /> Ajouter un mois
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4">
              {financials.length} mois enregistré{financials.length > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {allSorted.slice().reverse().map((f, idx, arr) => {
                // idx dans le tableau inversé → le "précédent" est idx+1
                const prevInReversed = arr[idx + 1];
                // mais on veut le mois précédent chronologiquement
                const idxInSorted = allSorted.findIndex(x => x.id === f.id);
                const previous = idxInSorted > 0 ? allSorted[idxInSorted - 1] : null;
                return (
                  <MonthCard
                    key={f.id} financial={f} previous={previous}
                    formatMonth={formatMonth} formatCurrency={formatCurrency}
                    onEdit={() => handleEdit(f)} onDelete={() => handleDelete(f.id)}
                    isDeleting={deletingId === f.id}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {showForm && (
        <FinancialForm
          onSubmit={editingFinancial ? handleUpdateFinancial : handleAddFinancial}
          onClose={() => { setShowForm(false); setEditingFinancial(null); }}
          initialData={editingFinancial || undefined}
          isLoading={loading}
        />
      )}
    </div>
  );
}

// ── Carte mensuelle ──────────────────────────────────────────
interface MonthCardProps {
  financial: MonthlyFinancial;
  previous: MonthlyFinancial | null;
  formatMonth: (d: string) => string;
  formatCurrency: (v: number) => string;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function MonthCard({ financial: f, previous, formatMonth, formatCurrency, onEdit, onDelete, isDeleting }: MonthCardProps) {
  const profit    = computeProfit(f, previous);
  const liquidite = getLiquidityTotal(f);
  const netPos    = getNetPosition(f);
  const margin    = f.revenue > 0 ? (profit / f.revenue) * 100 : null;

  const rows = [
    { icon: <Package      size={14} className="text-orange-400" />, label: 'Stock Amazon',        value: f.amazon_stock_value,  isDebt: false },
    { icon: <Clock        size={14} className="text-yellow-500" />, label: 'Stock en attente',    value: f.pending_stock_value, isDebt: false },
    { icon: <DollarSign   size={14} className="text-purple-400" />, label: 'Fonds Amazon',         value: f.amazon_funds,        isDebt: false },
    { icon: <Building2    size={14} className="text-teal-500"   />, label: 'Fonds en banque',      value: f.bank_funds,          isDebt: false },
    { icon: <BadgePercent size={14} className="text-pink-400"   />, label: 'Avoirs fournisseurs',  value: f.supplier_credits,    isDebt: false },
    { icon: <CreditCard   size={14} className="text-red-400"    />, label: 'Dettes',               value: (f as any).debts ?? 0, isDebt: true  },
  ];

  return (
    <div className="bg-white dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm dark:shadow-none hover:shadow-md dark:shadow-none transition-shadow flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-gray-50 dark:border-gray-700">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1 capitalize">
              {formatMonth(f.month)}
            </p>
            <p className={`text-2xl font-bold leading-tight ${profit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
              {formatCurrency(profit)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">Bénéfice net du mois</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-green-600">{formatCurrency(f.revenue)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-400">Chiffre d'affaires</p>
            {margin !== null && (
              <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                margin >= 0 ? 'bg-green-50 dark:bg-green-950 text-green-700' : 'bg-red-50 dark:bg-red-950 text-red-600'
              }`}>
                {margin.toFixed(1)}% marge
              </span>
            )}
          </div>
        </div>
        {/* Position nette du mois */}
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-xs text-gray-400 dark:text-gray-400">Position nette :</span>
          <span className={`text-xs font-semibold ${netPos >= 0 ? 'text-gray-700 dark:text-gray-300 dark:text-gray-700' : 'text-red-500'}`}>
            {formatCurrency(netPos)}
          </span>
          {previous && (
            <span className="text-xs text-gray-400 dark:text-gray-400 ml-1">
              (vs {formatCurrency(getNetPosition(previous))} mois préc.)
            </span>
          )}
        </div>
        {f.notes && <p className="text-xs text-gray-400 dark:text-gray-400 mt-1 italic line-clamp-1">{f.notes}</p>}
      </div>

      <div className="px-5 py-4 flex-1 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {row.icon}<span>{row.label}</span>
            </div>
            <span className={`text-xs font-semibold ${row.isDebt ? 'text-red-500' : 'text-gray-700 dark:text-gray-300 dark:text-gray-700'}`}>
              {formatCurrency(row.value)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs font-bold text-gray-600 dark:text-gray-400 dark:text-gray-400">Liquidité Totale</span>
          <span className="text-xs font-bold text-blue-700">{formatCurrency(liquidite)}</span>
        </div>
      </div>

      <div className="px-5 pb-5 pt-2 flex gap-2 border-t border-gray-50 dark:border-gray-700">
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 dark:text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors">
          <Edit2 size={14} /> Modifier
        </button>
        <button onClick={onDelete} disabled={isDeleting}
          className="flex items-center justify-center gap-1.5 border border-red-100 text-red-500 py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-50 dark:bg-red-950 transition-colors disabled:opacity-40"
          title="Supprimer">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}