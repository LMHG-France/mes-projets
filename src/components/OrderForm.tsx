import { useState } from 'react';
import { X, Plus, Trash2, Upload, Percent, ExternalLink, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Order, OrderItem } from '../hooks/useOrders';

interface OrderFormProps {
  onSubmit: (order: Omit<Order, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onClose: () => void;
  initialData?: Order;
  isLoading?: boolean;
}

export function OrderForm({ onSubmit, onClose, initialData, isLoading }: OrderFormProps) {
  const [supplierName, setSupplierName]               = useState(initialData?.supplier_name || '');
  const [items, setItems]                             = useState<OrderItem[]>(initialData?.items || []);
  const [trackingLink, setTrackingLink]               = useState(initialData?.tracking_link || '');
  const [orderLink, setOrderLink]                       = useState(initialData?.order_link || '');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(initialData?.expected_delivery_date || '');
  const [error, setError]                             = useState<string | null>(null);
  const [submitting, setSubmitting]                   = useState(false);
  const [extracting, setExtracting]                   = useState(false);
  const [isDragging, setIsDragging]                   = useState(false);
  const [discountInput, setDiscountInput]             = useState('');

  // État de l'extraction de date de livraison
  const [dateExtracting, setDateExtracting]   = useState(false);
  const [dateExtractStatus, setDateExtractStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [dateExtractMsg, setDateExtractMsg]   = useState('');

  // ── Extraction automatique de la date depuis le lien ─────────
  const extractDeliveryDate = async (url: string) => {
    // Accepte une URL ou un numéro de suivi brut (min 6 caractères alphanumériques)
    const isUrl = url.startsWith('http');
    const isTrackingNumber = !isUrl && /^[A-Z0-9]{6,35}$/i.test(url.trim());
    if (!url || (!isUrl && !isTrackingNumber)) return;

    setDateExtracting(true);
    setDateExtractStatus('idle');
    setDateExtractMsg('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/extract_delivery_date`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            // Pas d'order_id ici (commande pas encore sauvegardée)
            // La mise à jour en base se fera au submit ou via le cron
            tracking_url: url,
          }),
        }
      );

      const data = await response.json();

      if (data.delivery_date) {
        setExpectedDeliveryDate(data.delivery_date);
        setDateExtractStatus('success');
        setDateExtractMsg(`Date détectée automatiquement : ${new Date(data.delivery_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`);
      } else {
        setDateExtractStatus('error');
        setDateExtractMsg('Aucune date trouvée sur ce lien — vous pouvez la saisir manuellement.');
      }
    } catch {
      setDateExtractStatus('error');
      setDateExtractMsg('Impossible d\'analyser ce lien pour le moment.');
    } finally {
      setDateExtracting(false);
    }
  };

  const handleTrackingLinkBlur = () => {
    extractDeliveryDate(trackingLink);
  };

  // ── Autres handlers ──────────────────────────────────────────
  const addItem = () => setItems([...items, { name: '', quantity: 1, pricePerUnit: 0 }]);

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handlePriceInput = (index: number, value: string) => {
    const cleanValue = value.replace(',', '.');
    // Saisies intermédiaires valides : vide, point/virgule seul, signe moins seul, "-0", "-0."
    if (value === '' || value === '.' || value === ',' || value === '-' || value === '-.' || value === '-,') {
      const newItems = [...items];
      newItems[index] = { ...newItems[index], pricePerUnit: 0, price_ttc: 0, priceInput: value };
      setItems(newItems);
      return;
    }
    const numValue = parseFloat(cleanValue);
    if (!isNaN(numValue)) {
      const newItems = [...items];
      newItems[index] = { ...newItems[index], pricePerUnit: numValue, price_ttc: numValue, priceInput: value };
      setItems(newItems);
    }
  };

  const getTotalPrice = () =>
    items.reduce((total, item) => total + (item.quantity * (item.price_ttc || item.pricePerUnit)), 0);

  const applyDiscount = () => {
    const discountValue = parseFloat(discountInput);
    if (isNaN(discountValue) || discountValue <= 0 || discountValue >= 100) {
      setError('Veuillez entrer une réduction valide entre 0 et 100%');
      return;
    }
    const multiplier = 1 - discountValue / 100;
    setItems(items.map(item => {
      const newPrice = parseFloat((item.pricePerUnit * multiplier).toFixed(2));
      return { ...item, pricePerUnit: newPrice, price_ttc: newPrice, priceInput: String(newPrice) };
    }));
    setDiscountInput('');
    setError(null);
  };

  const processFile = async (file: File) => {
    setError(null);
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/extract_order_data`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${anonKey}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(`Erreur ${response.status}: ${data.details || data.error || 'Erreur extraction'}`);
        return;
      }
      if (data.error) { setError(data.error); return; }

      // Ne remplace le fournisseur que si pas encore rempli
      if (!supplierName) setSupplierName(data.supplier_name || '');
      const normalizedItems = (data.items || []).map((item: OrderItem) => {
        let unitPrice = item.pricePerUnit;
        if (item.price_ttc && item.quantity > 1) {
          const expectedTotal = item.pricePerUnit * item.quantity;
          if (Math.abs(item.price_ttc - expectedTotal) > expectedTotal * 0.1) unitPrice = item.price_ttc;
        } else if (item.price_ttc) {
          unitPrice = item.price_ttc;
        }
        return { ...item, pricePerUnit: unitPrice, price_ttc: unitPrice };
      });
      // Ajoute les nouveaux articles aux existants au lieu de remplacer
      setItems(prev => [...prev, ...normalizedItems]);

      // Si le lien de suivi est extrait, lancer aussi l'extraction de date
      if (data.tracking_link) {
        setTrackingLink(data.tracking_link);
        extractDeliveryDate(data.tracking_link);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du traitement');
    } finally {
      setExtracting(false);
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = '';
  };

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop      = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Veuillez déposer un fichier image ou PDF');
      return;
    }
    await processFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supplierName.trim()) { setError('Le nom du fournisseur est requis'); return; }
    if (items.length === 0)   { setError('Veuillez ajouter au moins un article'); return; }
    if (items.some(item => !item.name.trim() || isNaN(item.pricePerUnit))) {
      setError('Tous les articles doivent avoir un nom et un prix valide');
      return;
    }
    try {
      setSubmitting(true);
      const hadTrackingBefore = !!initialData?.tracking_link;
      const hasTrackingNow    = !!trackingLink;
      const trackingWasRemoved = hadTrackingBefore && !hasTrackingNow;

      await onSubmit({
        supplier_name:           supplierName,
        items,
        total_price:             getTotalPrice(),
        tracking_link:           trackingLink || null,
        order_link:              orderLink || null,
        expected_delivery_date:  expectedDeliveryDate || null,
        // Si le lien de suivi est supprimé → repasser en "pending"
        ...(trackingWasRemoved ? { delivery_status: 'pending', expected_delivery_date: null } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  };

  const isValidUrl = (url: string) => {
    try { new URL(url.startsWith('http') ? url : `https://${url}`); return url.trim().length > 0; }
    catch { return false; }
  };

  const handleOpenLink = () => {
    const url = trackingLink.startsWith('http') ? trackingLink : `https://${trackingLink}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? 'Modifier la commande' : 'Ajouter une commande'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Import screenshot */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Importer une screenshot ou facture de votre commande
            </label>
            <div className="flex gap-3">
              <input type="file" accept="image/*,application/pdf"
                onChange={handleScreenshotUpload} disabled={extracting}
                className="hidden" id="screenshot-input" />
              <label htmlFor="screenshot-input"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 cursor-pointer transition-colors">
                <Upload size={18} />
                {extracting ? 'Traitement...' : 'Poster votre commande'}
              </label>
              <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className={`flex-1 flex flex-col items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg transition-all ${
                  isDragging ? 'border-blue-600 bg-blue-100' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
                } ${extracting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <Upload size={18} className={isDragging ? 'text-blue-600' : 'text-gray-400'} />
                <span className={`text-sm font-medium ${isDragging ? 'text-blue-600' : 'text-gray-600'}`}>
                  {isDragging ? 'Déposer ici' : 'Glisser-déposer'}
                </span>
              </div>
            </div>
            {extracting && (
              <p className="mt-2 text-sm text-blue-700">
                L'IA analyse votre commande... Cela peut prendre quelques secondes.
              </p>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Ou remplissez manuellement</span>
            </div>
          </div>

          {/* Fournisseur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du fournisseur</label>
            <input type="text" value={supplierName} onChange={e => setSupplierName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Amazon, Aliexpress..." />
          </div>

          {/* Articles */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">Articles</label>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                <Plus size={16} /> Ajouter un article
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input type="text" value={item.name}
                      onChange={e => updateItem(index, 'name', e.target.value)}
                      placeholder="Nom du produit"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div className="w-24">
                    <input type="number" value={item.quantity}
                      onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      placeholder="Qté" min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div className="w-32">
                    <input type="text" inputMode="decimal"
                      value={item.priceInput !== undefined ? item.priceInput : item.pricePerUnit}
                      onChange={e => handlePriceInput(index, e.target.value)}
                      placeholder="Prix TTC"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    {item.price_ht && item.price_ttc && (
                      <div className="text-xs text-gray-500 mt-1">HT: {item.price_ht.toFixed(2)} €</div>
                    )}
                  </div>
                  <div className="w-28 text-right">
                    <div className="px-3 py-2 text-sm font-medium text-gray-900">
                      {(item.quantity * (item.price_ttc || item.pricePerUnit)).toFixed(2)} €
                    </div>
                  </div>
                  <button type="button" onClick={() => removeItem(index)}
                    className="text-red-500 hover:text-red-700 p-2">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
            {items.length === 0 && (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                Aucun article. Cliquez sur "Ajouter un article" pour commencer.
              </div>
            )}
            {items.length > 0 && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Appliquer une réduction</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input type="number" value={discountInput} onChange={e => setDiscountInput(e.target.value)}
                      placeholder="Ex: 15" step="0.1" min="0" max="99"
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <Percent size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                  <button type="button" onClick={applyDiscount} disabled={!discountInput}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    Appliquer
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  Cette réduction sera appliquée sur le prix unitaire de tous les articles
                </p>
              </div>
            )}
          </div>

          {/* ── Lien de la commande ───────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lien de la commande</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={orderLink}
                onChange={e => setOrderLink(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
              <button type="button"
                onClick={() => { if (orderLink) window.open(orderLink.startsWith('http') ? orderLink : `https://${orderLink}`, '_blank'); }}
                disabled={!orderLink}
                title="Ouvrir le lien"
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
                <ExternalLink size={16} /> Ouvrir
              </button>
            </div>
          </div>

          {/* ── Lien commande + extraction auto de date ─────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lien de suivi</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={trackingLink}
                onChange={e => { setTrackingLink(e.target.value); setDateExtractStatus('idle'); }}
                onBlur={handleTrackingLinkBlur}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
              <button type="button" onClick={handleOpenLink} disabled={!isValidUrl(trackingLink)} style={{display: trackingLink && !trackingLink.startsWith("http") ? "none" : ""}}
                title="Ouvrir le lien"
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
                <ExternalLink size={16} /> Ouvrir
              </button>
            </div>

            {/* Indicateur d'extraction de date */}
            {dateExtracting && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                <Loader2 size={14} className="animate-spin" />
                Recherche de la date de livraison sur ce lien...
              </div>
            )}
            {!dateExtracting && dateExtractStatus === 'success' && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle size={14} className="shrink-0" />
                {dateExtractMsg}
              </div>
            )}
            {!dateExtracting && dateExtractStatus === 'error' && (
              <div className="mt-2 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="shrink-0" />
                {dateExtractMsg}
              </div>
            )}
          </div>

          {/* Livraison prévue */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Livraison prévue
              {dateExtractStatus === 'success' && (
                <span className="ml-2 text-xs font-normal text-green-600">
                  (rempli automatiquement — modifiable)
                </span>
              )}
            </label>
            <input type="date" value={expectedDeliveryDate}
              onChange={e => setExpectedDeliveryDate(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                dateExtractStatus === 'success'
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300'
              }`} />
          </div>

          {/* Prix total */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-gray-700">Prix total:</span>
              <span className="text-2xl font-bold text-blue-600">{getTotalPrice().toFixed(2)} €</span>
            </div>
          </div>

          {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

          <div className="flex gap-3">
            <button type="submit" disabled={submitting || isLoading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {submitting || isLoading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}