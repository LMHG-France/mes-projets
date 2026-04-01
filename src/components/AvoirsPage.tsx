import { useState, useCallback, useEffect } from 'react';
import { Plus, CreditCard, Eye, EyeOff, Trash2, Edit2, X, Check, ChevronRight, Loader2, AlertCircle, Gift } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LoyaltyCard {
  id: string;
  supplier_name: string;
  label: string;
  balance: number;
  email: string | null;
  password_encrypted: string | null;
  color: string;
  notes: string | null;
  created_at: string;
}

const CARD_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
];

// ─── Modal: Create / Edit ─────────────────────────────────────────────────────
function CardModal({
  initial, onSave, onClose,
}: {
  initial?: Partial<LoyaltyCard>;
  onSave: (data: Omit<LoyaltyCard, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
}) {
  const [supplierName, setSupplierName]     = useState(initial?.supplier_name || '');
  const [label, setLabel]                   = useState(initial?.label || '');
  const [balance, setBalance]               = useState(String(initial?.balance ?? ''));
  const [email, setEmail]                   = useState(initial?.email || '');
  const [password, setPassword]             = useState(initial?.password_encrypted || '');
  const [notes, setNotes]                   = useState(initial?.notes || '');
  const [color, setColor]                   = useState(initial?.color || CARD_COLORS[0]);
  const [showPwd, setShowPwd]               = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState('');

  const handleSubmit = async () => {
    if (!supplierName.trim()) { setError('Le nom du fournisseur est requis'); return; }
    setSaving(true);
    try {
      await onSave({
        supplier_name:      supplierName.trim(),
        label:              label.trim() || supplierName.trim(),
        balance:            parseFloat(balance) || 0,
        email:              email.trim() || null,
        password_encrypted: password || null,
        color,
        notes:              notes.trim() || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900">{initial?.id ? 'Modifier la carte' : 'Nouvelle carte fidélité'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Color picker */}
        <div className="flex gap-2 mb-4">
          {CARD_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{ background: c, borderColor: color === c ? '#1e293b' : 'transparent' }} />
          ))}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fournisseur *</label>
              <input value={supplierName} onChange={e => setSupplierName(e.target.value)}
                placeholder="ex: Carrefour"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Libellé</label>
              <input value={label} onChange={e => setLabel(e.target.value)}
                placeholder="ex: Carte principale"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Solde (€)</label>
            <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="compte@email.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mot de passe</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <button onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Infos supplémentaires..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle size={13} />{error}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">Annuler</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {initial?.id ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Visual Card ──────────────────────────────────────────────────────────────
function VisualCard({ card, isSelected, onClick }: { card: LoyaltyCard; isSelected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick}
      className={`cursor-pointer rounded-2xl p-4 transition-all hover:scale-[1.02] ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
      style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}cc)` }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-white/70 text-xs font-medium">{card.supplier_name}</p>
          <p className="text-white font-bold text-sm mt-0.5">{card.label}</p>
        </div>
        <Gift size={20} className="text-white/60" />
      </div>
      <div>
        <p className="text-white/70 text-xs">Solde disponible</p>
        <p className="text-white text-2xl font-bold jb">{card.balance.toFixed(2)} €</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AvoirsPage() {
  const { user }  = useAuth();
  const [cards, setCards]           = useState<LoyaltyCard[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<string | null>(null);
  const [showModal, setShowModal]   = useState(false);
  const [editCard, setEditCard]     = useState<LoyaltyCard | null>(null);
  const [showPwd, setShowPwd]       = useState(false);
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [newBalance, setNewBalance]         = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCards = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('loyalty_cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setCards(data || []);
    if (data?.length && !selected) setSelected(data[0].id);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const selectedCard = cards.find(c => c.id === selected) ?? null;

  const handleSave = async (data: Omit<LoyaltyCard, 'id' | 'created_at'>) => {
    if (!user) return;
    if (editCard) {
      const { error } = await supabase.from('loyalty_cards').update(data).eq('id', editCard.id);
      if (error) throw error;
      showToast('Carte mise à jour');
    } else {
      const { error } = await supabase.from('loyalty_cards').insert({ ...data, user_id: user.id });
      if (error) throw error;
      showToast('Carte créée');
    }
    setEditCard(null);
    await fetchCards();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('loyalty_cards').delete().eq('id', id);
    if (error) { showToast('Erreur suppression', 'error'); return; }
    setCards(prev => prev.filter(c => c.id !== id));
    if (selected === id) setSelected(cards.find(c => c.id !== id)?.id ?? null);
    setConfirmDelete(null);
    showToast('Carte supprimée');
  };

  const handleUpdateBalance = async () => {
    if (!selectedCard) return;
    const val = parseFloat(newBalance);
    if (isNaN(val)) return;
    await supabase.from('loyalty_cards').update({ balance: val }).eq('id', selectedCard.id);
    setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, balance: val } : c));
    setEditingBalance(false);
    showToast('Solde mis à jour');
  };

  const totalBalance = cards.reduce((s, c) => s + c.balance, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-full py-32">
      <Loader2 size={32} className="animate-spin text-blue-400" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Avoirs & Cartes fidélité</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {cards.length} carte{cards.length > 1 ? 's' : ''} — Total : <span className="font-semibold text-gray-700">{totalBalance.toFixed(2)} €</span>
          </p>
        </div>
        <button onClick={() => { setEditCard(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
          <Plus size={16} />Ajouter une carte
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
          <CreditCard size={48} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Aucune carte fidélité</p>
          <p className="text-gray-400 text-sm mt-1">Ajoutez vos cartes pour suivre vos avoirs</p>
          <button onClick={() => setShowModal(true)}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            <Plus size={15} />Ajouter une carte
          </button>
        </div>
      ) : (
        <div className="flex gap-5 items-start">
          {/* Left: card grid */}
          <div className="w-72 flex-shrink-0 space-y-3">
            {cards.map(card => (
              <VisualCard key={card.id} card={card} isSelected={card.id === selected} onClick={() => setSelected(card.id)} />
            ))}
          </div>

          {/* Right: detail */}
          {selectedCard && (
            <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Card banner */}
              <div className="h-2 w-full" style={{ background: selectedCard.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedCard.label}</h2>
                    <p className="text-sm text-gray-400">{selectedCard.supplier_name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditCard(selectedCard); setShowModal(true); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                      <Edit2 size={11} />Modifier
                    </button>
                    <button onClick={() => setConfirmDelete(selectedCard.id)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors">
                      <Trash2 size={11} />Supprimer
                    </button>
                  </div>
                </div>

                {/* Balance */}
                <div className="rounded-2xl p-5 mb-4" style={{ background: `${selectedCard.color}15` }}>
                  <p className="text-xs font-medium text-gray-500 mb-1">Solde disponible</p>
                  {editingBalance ? (
                    <div className="flex items-center gap-2">
                      <input autoFocus type="number" step="0.01" value={newBalance}
                        onChange={e => setNewBalance(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateBalance(); if (e.key === 'Escape') setEditingBalance(false); }}
                        className="text-2xl font-bold w-36 bg-white border border-gray-200 rounded-xl px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 jb" />
                      <span className="text-2xl font-bold text-gray-400">€</span>
                      <button onClick={handleUpdateBalance}
                        className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"><Check size={14} /></button>
                      <button onClick={() => setEditingBalance(false)}
                        className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-end gap-3">
                      <p className="text-3xl font-bold jb" style={{ color: selectedCard.color }}>
                        {selectedCard.balance.toFixed(2)} €
                      </p>
                      <button onClick={() => { setNewBalance(String(selectedCard.balance)); setEditingBalance(true); }}
                        className="mb-1 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-0.5 hover:bg-gray-50">
                        Modifier
                      </button>
                    </div>
                  )}
                </div>

                {/* Credentials */}
                <div className="space-y-3">
                  {selectedCard.email && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-0.5">Email</p>
                        <p className="text-sm font-medium text-gray-800">{selectedCard.email}</p>
                      </div>
                    </div>
                  )}

                  {selectedCard.password_encrypted && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-400 mb-0.5">Mot de passe</p>
                        <p className="text-sm font-medium text-gray-800 font-mono">
                          {showPwd ? selectedCard.password_encrypted : '••••••••'}
                        </p>
                      </div>
                      <button onClick={() => setShowPwd(v => !v)}
                        className="ml-3 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  )}

                  {selectedCard.notes && (
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-xs font-medium text-gray-400 mb-0.5">Note</p>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedCard.notes}</p>
                    </div>
                  )}

                  {!selectedCard.email && !selectedCard.password_encrypted && !selectedCard.notes && (
                    <p className="text-xs text-gray-300 text-center py-4 italic">Aucune information supplémentaire</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CardModal
          initial={editCard || undefined}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditCard(null); }}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <p className="text-center font-semibold text-gray-900 mb-1">Supprimer cette carte ?</p>
            <p className="text-center text-sm text-gray-400 mb-5">Cette action est irréversible.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">Annuler</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-sm font-semibold text-white hover:bg-red-600">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-gray-900'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}