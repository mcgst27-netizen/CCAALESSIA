import { useEffect, useState } from 'react';
import { AdminLayout } from './components/admin/AdminLayout';
import { LoginModal } from './components/admin/LoginModal';
import { ChildLockButton } from './components/common/ChildLockButton';
import { ActivityScreen } from './components/game/ActivityScreen';
import { HomeCategories } from './components/game/HomeCategories';
import { SubjectSelector } from './components/game/SubjectSelector';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CaaDataProvider, useCaaData } from './context/CaaDataContext';
import { isFirebaseConfigured } from './lib/firebase';
import { stopAllAudio, unlockAudioForIOS } from './lib/speechEngine';

function AppShell() {
  const { user } = useAuth();
  const { config, categories, predicates, options, subjects, loading } = useCaaData();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Desbloqueo automático de AudioContext y voces TTS en el primer toque táctil (iPadOS Safari)
  useEffect(() => {
    const unlock = () => unlockAudioForIOS();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchend', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchend', unlock);
    };
  }, []);

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center p-6 bg-[#F8FAFC]">
        <div className="bg-white rounded-3xl border-[4px] border-amber-300 shadow-sm p-8 max-w-xl space-y-4">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Configura Firebase para comenzar
          </h1>
          <p className="text-slate-600">
            Copia el archivo <code className="bg-slate-100 px-1.5 py-0.5 rounded">.env.example</code> a{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded">.env</code> y pega las credenciales de tu proyecto gratuito de Firebase (Plan Spark).
          </p>
          <p className="text-sm text-slate-500">
            Revisa la guía paso a paso en <strong>README.md</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (isAdminOpen && user) {
    return (
      <AdminLayout
        onLockAndExit={() => {
          stopAllAudio();
          setIsAdminOpen(false);
        }}
      />
    );
  }

  const selectedCategory =
    categories.find((c) => c.id === selectedCategoryId) ?? null;
  const selectedSubject =
    subjects.find((s) => s.id === selectedSubjectId) ?? null;

  const handleLockCompleted = () => {
    stopAllAudio();
    if (user) {
      setIsAdminOpen(true);
    } else {
      setShowLoginModal(true);
    }
  };

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#F8FAFC]">
      <ChildLockButton onUnlock={handleLockCompleted} />

      {loading ? (
        <div className="h-full w-full flex items-center justify-center text-slate-500 text-xl font-semibold">
          Cargando...
        </div>
      ) : selectedSubject ? (
        <ActivityScreen
          subject={selectedSubject}
          predicates={predicates}
          options={options}
          config={config}
          onBack={() => setSelectedSubjectId(null)}
        />
      ) : selectedCategory ? (
        <SubjectSelector
          category={selectedCategory}
          subjects={subjects}
          onBack={() => setSelectedCategoryId(null)}
          onSelectSubject={(subj) => setSelectedSubjectId(subj.id)}
        />
      ) : (
        <HomeCategories
          categories={categories}
          config={config}
          onSelectCategory={(cat) => setSelectedCategoryId(cat.id)}
        />
      )}

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setShowLoginModal(false);
            setIsAdminOpen(true);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CaaDataProvider>
        <AppShell />
      </CaaDataProvider>
    </AuthProvider>
  );
}
