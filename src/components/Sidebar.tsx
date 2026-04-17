import { Package, Menu, X, LogOut, DollarSign, History, CreditCard, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const menuItems = [
    { id: 'inventaire', label: 'Inventaire',       icon: Package    },
    { id: 'historique', label: 'Base produits',    icon: History    },
    { id: 'financial',  label: 'Suivi Financier',  icon: DollarSign },
    { id: 'avoirs',     label: 'Avoirs & Fidélité', icon: CreditCard },
  ];

  const navigate = (id: string) => { onNavigate(id); setIsOpen(false); };

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          {isOpen ? <X size={22} className="text-gray-700 dark:text-gray-300" /> : <Menu size={22} className="text-gray-700 dark:text-gray-300" />}
        </button>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {menuItems.find(m => m.id === activeView)?.label || 'Menu'}
        </span>
        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          {theme === 'dark'
            ? <Sun size={18} className="text-yellow-400" />
            : <Moon size={18} className="text-gray-500" />}
        </button>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen bg-white dark:bg-gray-900 shadow-lg z-40 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } w-64 flex flex-col border-r border-gray-100 dark:border-gray-800`}>
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Menu</h2>
          {/* Theme toggle desktop */}
          <button onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={theme === 'dark' ? 'Mode jour' : 'Mode nuit'}>
            {theme === 'dark'
              ? <Sun size={18} className="text-yellow-400" />
              : <Moon size={18} className="text-gray-400" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeView === item.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                }`}>
                <Icon size={20} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-sm">
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Mobile overlay ── */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setIsOpen(false)} />
      )}

      {/* ── Mobile bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-around px-2 py-1 safe-area-pb">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button key={item.id} onClick={() => navigate(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all ${
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'
              }`}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium leading-none">
                {item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
        <button onClick={signOut} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-red-400">
          <LogOut size={20} strokeWidth={1.8} />
          <span className="text-[10px] font-medium leading-none">Quitter</span>
        </button>
      </nav>
    </>
  );
}