import { Package } from 'lucide-react';

export function StockManager() {
  return (
    <div className="py-8 px-4 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Package size={32} className="text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Stock en attente</h1>
            <p className="text-gray-600 mt-1">Gérez vos produits en attente de traitement</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center text-gray-500">
            <Package size={64} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg">Aucun stock en attente pour le moment</p>
            <p className="text-sm mt-2">Les produits en attente apparaîtront ici</p>
          </div>
        </div>
      </div>
    </div>
  );
}
