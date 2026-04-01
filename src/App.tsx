import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Auth } from './components/Auth';
import { InventairePage } from './components/InventairePage';
import { ProfitManager } from './components/ProfitManager';
import { FinancialTracker } from './components/FinancialTracker';
import { HistoriquePage } from './components/HistoriquePage';
import { AvoirsPage }    from './components/AvoirsPage';
import { Sidebar } from './components/Sidebar';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState('inventaire');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            Gestionnaire de Commandes
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Organisez vos commandes facilement
          </p>
          <Auth />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 overflow-auto">
        {activeView === 'inventaire' && <InventairePage />}
        {activeView === 'financial'  && <FinancialTracker />}
        {activeView === 'profit'     && <ProfitManager />}
        {activeView === 'historique' && <HistoriquePage />}
        {activeView === 'avoirs'     && <AvoirsPage />}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;