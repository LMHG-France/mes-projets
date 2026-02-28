import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, Edit2, Trash2, Package, Wallet, CreditCard, Building2, Users, PiggyBank } from 'lucide-react';
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
      alert('Erreur lors de l\'ajout des données financières');
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

  const formatMonth = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (value: number) => {
    return value.toFixed(2) + ' €';
  };

  const latestFinancial = financials[0];

  return (
    <div className="py-8 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Suivi Financier</h1>
            <p className="text-gray-600 mt-1">Suivez vos performances financières mensuelles</p>
          </div>
          <button
            onClick={() => {
              setEditingFinancial(null);
              setShowForm(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Ajouter un mois
          </button>
        </div>

        {latestFinancial && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Aperçu du mois - {formatMonth(latestFinancial.month)}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-md p-6 border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-green-500 p-3 rounded-lg">
                    <TrendingUp className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-green-700 font-medium">Chiffre d'Affaire</p>
                    <p className="text-2xl font-bold text-green-900">{formatCurrency(latestFinancial.revenue)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md p-6 border border-blue-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-blue-500 p-3 rounded-lg">
                    <DollarSign className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-blue-700 font-medium">Bénéfice</p>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(latestFinancial.profit)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md p-6 border border-orange-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-orange-500 p-3 rounded-lg">
                    <Package className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-orange-700 font-medium">Stock Amazon</p>
                    <p className="text-2xl font-bold text-orange-900">{formatCurrency(latestFinancial.amazon_stock_value)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl shadow-md p-6 border border-teal-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-teal-500 p-3 rounded-lg">
                    <Wallet className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-teal-700 font-medium">Fonds en Banque</p>
                    <p className="text-2xl font-bold text-teal-900">{formatCurrency(latestFinancial.bank_funds)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement des données financières...</p>
          </div>
        ) : financials.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <TrendingUp size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">Aucune donnée financière pour le moment</p>
            <p className="text-gray-400 text-sm">Commencez en cliquant sur "Ajouter un mois"</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Mois</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">CA</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Bénéfice</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Stock Amazon</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Stock en Attente</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Fonds Amazon</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Fonds Banque</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Avoirs</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {financials.map((financial) => (
                    <tr key={financial.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{formatMonth(financial.month)}</div>
                        {financial.notes && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">{financial.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-green-700">{formatCurrency(financial.revenue)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-semibold ${financial.profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                          {formatCurrency(financial.profit)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                        {formatCurrency(financial.amazon_stock_value)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                        {formatCurrency(financial.pending_stock_value)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                        {formatCurrency(financial.amazon_funds)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                        {formatCurrency(financial.bank_funds)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                        {formatCurrency(financial.supplier_credits)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(financial)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(financial.id)}
                            disabled={deletingId === financial.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showForm && (
          <FinancialForm
            onSubmit={editingFinancial ? handleUpdateFinancial : handleAddFinancial}
            onClose={handleCloseForm}
            initialData={editingFinancial || undefined}
            isLoading={loading}
          />
        )}
      </div>
    </div>
  );
}
