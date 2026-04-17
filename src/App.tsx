import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Auth } from './components/Auth';
import { InventairePage } from './components/InventairePage';
import { ProfitManager } from './components/ProfitManager';
import { FinancialTracker } from './components/FinancialTracker';
import { HistoriquePage } from './components/HistoriquePage';
import { AvoirsPage } from './components/AvoirsPage';
import { Sidebar } from './components/Sidebar';

function AppContent() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const [activeView, setActiveView] = useState('inventaire');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-100 dark:border-gray-800">
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
            Gestionnaire de Commandes
          </h1>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
            Organisez vos commandes facilement
          </p>
          <Auth />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen transition-colors duration-200" style={{ background: theme === 'dark' ? '#0f172a' : 'linear-gradient(135deg, #eff6ff, #e0e7ff)' }}>
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      {/* pt-14 = mobile top bar height, pb-16 = mobile bottom nav height */}
      <main className="flex-1 overflow-auto pt-14 pb-16 lg:pt-0 lg:pb-0">
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
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;