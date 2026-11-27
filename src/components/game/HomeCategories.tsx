import { playSingleCard } from '../../lib/speechEngine';
import type { AppConfig, CategoryDoc } from '../../types/caa';
import { FitzgeraldCard } from '../common/FitzgeraldCard';

interface HomeCategoriesProps {
  categories: CategoryDoc[];
  config: AppConfig;
  onSelectCategory: (category: CategoryDoc) => void;
}

export function HomeCategories({
  categories,
  config,
  onSelectCategory,
}: HomeCategoriesProps) {
  const activeCategories = categories.filter((cat) => {
    if (!cat.active) return false;
    if (config.visibleCategoryIds.length > 0) {
      return config.visibleCategoryIds.includes(cat.id);
    }
    return true;
  });

  const handleSelect = (category: CategoryDoc) => {
    playSingleCard({
      text: category.name,
      audioMediaId: category.audioMediaId,
    }).catch(() => undefined);
    onSelectCategory(category);
  };

  if (activeCategories.length === 0) {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden flex items-center justify-center p-8 bg-[#F8FAFC]">
        <div className="bg-white rounded-3xl border-[4px] border-slate-200 shadow-sm p-10 max-w-xl text-center space-y-4">
          <div className="text-6xl">🧩</div>
          <h1 className="text-2xl font-extrabold text-slate-800">
            Aún no hay categorías activas
          </h1>
          <p className="text-slate-600 text-lg">
            Mantén presionado el ícono de candado en la esquina superior derecha durante{' '}
            <strong>3 segundos</strong> para iniciar sesión y cargar los ejemplos iniciales.
          </p>
        </div>
      </div>
    );
  }

  // Si solo hay 1 categoría activa, mostrarla gigante y centrada sin distracciones
  if (activeCategories.length === 1) {
    const only = activeCategories[0];
    return (
      <div className="caa-game-surface h-[100dvh] w-screen overflow-hidden flex items-center justify-center p-8 bg-[#F8FAFC]">
        <FitzgeraldCard
          label={only.name}
          color={only.fitzgeraldColor ?? 'orange'}
          imageMediaId={only.imageMediaId}
          emojiFallback={only.emojiFallback ?? '🦁'}
          size="xl"
          onClick={() => handleSelect(only)}
          className="w-full max-w-md min-h-[340px]"
        />
      </div>
    );
  }

  const gridCols =
    activeCategories.length === 2
      ? 'grid-cols-2 max-w-4xl'
      : activeCategories.length === 3
        ? 'grid-cols-3 max-w-5xl'
        : 'grid-cols-2 md:grid-cols-4 max-w-6xl';

  return (
    <div className="caa-game-surface h-[100dvh] w-screen overflow-hidden flex items-center justify-center p-8 bg-[#F8FAFC]">
      <div className={`grid ${gridCols} gap-8 w-full`}>
        {activeCategories.map((cat) => (
          <FitzgeraldCard
            key={cat.id}
            label={cat.name}
            color={cat.fitzgeraldColor ?? 'orange'}
            imageMediaId={cat.imageMediaId}
            emojiFallback={cat.emojiFallback ?? '📂'}
            size="lg"
            onClick={() => handleSelect(cat)}
            className="min-h-[260px] w-full"
          />
        ))}
      </div>
    </div>
  );
}
