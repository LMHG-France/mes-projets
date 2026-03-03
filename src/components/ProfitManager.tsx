import { TrendingUp } from 'lucide-react';

export function ProfitManager() {
  return (
    <div className="py-8 px-4 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp size={32} className="text-green-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profit</h1>
            <p className="text-gray-600 mt-1">Suivez vos bénéfices et performances</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Profit Total</h3>
            <p className="text-3xl font-bold text-green-600">0 €</p>
            <p className="text-sm text-gray-500 mt-1">Toutes les commandes</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Profit Mensuel</h3>
            <p className="text-3xl font-bold text-blue-600">0 €</p>
            <p className="text-sm text-gray-500 mt-1">Ce mois-ci</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Marge Moyenne</h3>
            <p className="text-3xl font-bold text-gray-900">0%</p>
            <p className="text-sm text-gray-500 mt-1">Sur toutes les ventes</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center text-gray-500">
            <TrendingUp size={64} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg">Aucune donnée de profit disponible</p>
            <p className="text-sm mt-2">Les statistiques apparaîtront une fois que vous aurez des commandes</p>
          </div>
        </div>
      </div>
    </div>
  );
}