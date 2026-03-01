import { useState } from 'react';
import {
  Plus, TrendingUp, DollarSign, Edit2, Trash2,
  Package, Wallet, Clock, Building2, BadgePercent
} from 'lucide-react';
import { useFinancials, MonthlyFinancial } from '../hooks/useFinancials';
import { FinancialForm } from './FinancialForm';

export function FinancialTracker() {
  const { financials, loading, addFinancial, updateFinancial, deleteFinancial } = useFinancials();
  const [showForm, setShowForm] = useState(false);
  const [editingFinancial, setEditingFinancial] = useState<MonthlyFinancial | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddFinancial = async (data: Omit<MonthlyFinancial, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      await addFinancial(data);
      setShowForm(false);
    } catch (error) {
      alert("Erreur lors de l'ajout des données financières");
    }
  };

  const handleUpdateFinancial = async (data: Omit<MonthlyFinancial, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (editingFinancial) {
      try {
        await updateFinancial(editingFinancial.id, data);
        setEditingFinancial(null);
        setShowForm(false);
      } catch (error) {
        alert('Erreur lors de la mise à jour des données financières');
      }
    }
  };

  const handleEdit = (financial: MonthlyFinancial) => {
    setEditingFinancial(financial);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ces données financières ?')) {
      try {
        setDeletingId(id);
        await deleteFinancial(id);
      } catch (error) {
        alert('Erreur lors de la suppression');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingFinancial(null);
  };

  const formatMonth = (dateString: string) =>
    new Date(dateString).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + ' €';

  // ── Calculs synthèse ──────────────────────────────────────────
  const totalProfit = financials.reduce((sum, f) => sum + f.profit, 0);

  const currentMonthProfit = (() => {
    const now = new Date();
    const current = financials.find(f => {
      const d = new Date(f.month);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return current?.profit ?? 0;
  })();

  const averageMargin = (() => {
    const withRevenue = financials.filter(f => f.revenue > 0);
    if (!withRevenue.length) return 0;
    return withRevenue.reduce((sum, f) => sum + (f.profit / f.revenue) * 100, 0) / withRevenue.length;
  })();
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="py-8 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* ── En-tête ── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Suivi Financier</h1>
            <p className="text-gray-500 mt-1">Gérez vos performances financières mensuelles</p>
          </div>
          <button
            onClick={() => { setEditingFinancial(null); setShowForm(true); }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Ajouter un mois
          </button>
        </div>

        {/* ── 3 cartes synthèse Profit ── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-green-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">Profit</h2>
            <span className="text-sm text-gray-400">— Suivez vos bénéfices et performances</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <p className="text-sm font-semibold text-gray-600 mb-1">Profit Total</p>
              <p className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalProfit)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Tous les mois confondus</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <p className="text-sm font-semibold text-gray-600 mb-1">Profit Mensuel</p>
              <p className={`text-3xl font-bold ${currentMonthProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(currentMonthProfit)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Ce mois-ci</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <p className="text-sm font-semibold text-gray-600 mb-1">Marge Moyenne</p>
              <p className={`text-3xl font-bold ${averageMargin >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {averageMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400 mt-1">Sur toutes les ventes</p>
            </div>
          </div>
        </div>

        {/* ── Liste des mois ── */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-500">Chargement des données financières...</p>
          </div>

        ) : financials.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mb-4">
              <TrendingUp size={32} className="text-blue-400" />
            </div>
            <p className="text-gray-700 font-medium text-lg mb-1">Aucune donnée financière</p>
            <p className="text-gray-400 text-sm mb-6">Commencez par ajouter votre premier mois</p>
            <button
              onClick={() => { setEditingFinancial(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus size={16} />
              Ajouter un mois
            </button>
          </div>

        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {financials.length} mois enregistré{financials.length > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {financials.map((f) => (
                <MonthCard
                  key={f.id}
                  financial={f}
                  formatMonth={formatMonth}
                  formatCurrency={formatCurrency}
                  onEdit={() => handleEdit(f)}
                  onDelete={() => handleDelete(f.id)}
                  isDeleting={deletingId === f.id}
                />
              ))}
            </div>
          </>
        )}

      </div>

      {/* ── Modale formulaire ── */}
      {showForm && (
        <FinancialForm
          onSubmit={editingFinancial ? handleUpdateFinancial : handleAddFinancial}
          onClose={handleCloseForm}
          initialData={editingFinancial || undefined}
          isLoading={loading}
        />
      )}
    </div>
  );
}

// ── Composant carte mensuelle ─────────────────────────────────
interface MonthCardProps {
  financial: MonthlyFinancial;
  formatMonth: (d: string) => string;
  formatCurrency: (v: number) => string;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function MonthCard({ financial: f, formatMonth, formatCurrency, onEdit, onDelete, isDeleting }: MonthCardProps) {
  const rows = [
    { icon: <Package    size={14} className="text-orange-400" />, label: 'Stock Amazon',        value: f.amazon_stock_value },
    { icon: <Clock      size={14} className="text-yellow-500" />, label: 'Stock en attente',    value: f.pending_stock_value },
    { icon: <DollarSign size={14} className="text-blue-400"  />, label: 'Fonds Amazon',         value: f.amazon_funds },
    { icon: <Building2  size={14} className="text-teal-500"  />, label: 'Fonds en banque',      value: f.bank_funds },
    { icon: <BadgePercent size={14} className="text-purple-400" />, label: 'Avoir fournisseurs', value: f.supplier_credits },
  ];

  const margin = f.revenue > 0 ? (f.profit / f.revenue) * 100 : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 capitalize">
              {formatMonth(f.month)}
            </p>
            <p className={`text-2xl font-bold leading-tight ${f.profit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
              {formatCurrency(f.profit)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Bénéfice net</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-green-600">{formatCurrency(f.revenue)}</p>
            <p className="text-xs text-gray-400">Chiffre d'affaires</p>
            {margin !== null && (
              <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                margin >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                {margin.toFixed(1)}% marge
              </span>
            )}
          </div>
        </div>
        {f.notes && (
          <p className="text-xs text-gray-400 mt-2 italic line-clamp-1">{f.notes}</p>
        )}
      </div>

      {/* Détails stocks & trésorerie */}
      <div className="px-5 py-4 flex-1 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {row.icon}
              <span>{row.label}</span>
            </div>
            <span className="text-xs font-semibold text-gray-700">{formatCurrency(row.value)}</span>
          </div>
        ))}
      </div>

      {/* Boutons */}
      <div className="px-5 pb-5 pt-2 flex gap-2 border-t border-gray-50">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Edit2 size={14} />
          Modifier
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="flex items-center justify-center gap-1.5 border border-red-100 text-red-500 py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40"
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}