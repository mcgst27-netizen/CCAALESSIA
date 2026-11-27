import { useState } from 'react';
import { FolderTree, Lock, MessageSquareText, PawPrint, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CategoriesManager } from './CategoriesManager';
import { PredicatesAndOptionsManager } from './PredicatesAndOptionsManager';
import { SettingsAndBackup } from './SettingsAndBackup';
import { SubjectsManager } from './SubjectsManager';

type AdminTab = 'subjects' | 'categories' | 'predicates' | 'settings';

interface AdminLayoutProps {
  onLockAndExit: () => void;
}

export function AdminLayout({ onLockAndExit }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<AdminTab>('subjects');
  const [locking, setLocking] = useState(false);

  const handleLock = async () => {
    setLocking(true);
    try {
      await logout();
    } finally {
      setLocking(false);
      onLockAndExit();
    }
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'subjects', label: 'Sujetos', icon: <PawPrint className="w-4 h-4" /> },
    { id: 'categories', label: 'Categorías', icon: <FolderTree className="w-4 h-4" /> },
    {
      id: 'predicates',
      label: 'Verbos y Opciones',
      icon: <MessageSquareText className="w-4 h-4" />,
    },
    { id: 'settings', label: 'Ajustes y Respaldo', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-slate-100 flex flex-col">
      {/* Banner superior claro con botón grande para bloquear y volver al juego */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white px-4 md:px-6 py-3 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
              <h1 className="text-base md:text-lg font-extrabold tracking-tight">
                Modo Edición (Administrador)
              </h1>
            </div>
            {user?.email && (
              <p className="text-xs text-slate-300">Sesión: {user.email}</p>
            )}
          </div>

          <button
            type="button"
            disabled={locking}
            onClick={handleLock}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm md:text-base shadow-sm active:scale-95 transition"
          >
            <Lock className="w-4 h-4" />
            {locking ? 'Bloqueando...' : 'Bloquear y volver al juego'}
          </button>
        </div>
      </header>

      {/* Navegación por pestañas */}
      <nav className="bg-white border-b border-slate-200 px-4 md:px-6">
        <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto py-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${
                tab === item.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6">
        {tab === 'subjects' && <SubjectsManager />}
        {tab === 'categories' && <CategoriesManager />}
        {tab === 'predicates' && <PredicatesAndOptionsManager />}
        {tab === 'settings' && <SettingsAndBackup />}
      </main>
    </div>
  );
}
