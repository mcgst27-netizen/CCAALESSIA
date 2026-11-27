import { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { normalizePhrase, playSingleCard } from '../../lib/speechEngine';
import type { CategoryDoc, SubjectDoc } from '../../types/caa';
import { FitzgeraldCard } from '../common/FitzgeraldCard';

const PAGE_SIZE = 6; // Máximo 6 tarjetas visibles (3 columnas x 2 filas en landscape)

interface SubjectSelectorProps {
  category: CategoryDoc;
  subjects: SubjectDoc[];
  onBack: () => void;
  onSelectSubject: (subject: SubjectDoc) => void;
}

export function SubjectSelector({
  category,
  subjects,
  onBack,
  onSelectSubject,
}: SubjectSelectorProps) {
  const activeSubjects = subjects.filter(
    (s) => s.active && s.categoryId === category.id,
  );
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(activeSubjects.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleSubjects = activeSubjects.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const handleTapSubject = (subject: SubjectDoc) => {
    const spoken = normalizePhrase([subject.article, subject.name]);
    playSingleCard({
      text: spoken,
      audioMediaId: subject.audioMediaId,
    }).catch(() => undefined);
    onSelectSubject(subject);
  };

  return (
    <div className="caa-game-surface h-[100dvh] w-screen overflow-hidden flex flex-col bg-[#F8FAFC] p-5 md:p-6">
      {/* Barra superior limpia */}
      <div className="flex items-center justify-between mb-4 pr-14 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2.5 px-5 py-3 min-h-[56px] rounded-2xl bg-white border-[3px] border-slate-300 text-slate-800 text-xl font-bold shadow-sm active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-6 h-6" />
          Volver
        </button>

        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-700 tracking-tight">
          {category.name}
        </h1>

        <div className="w-28 flex justify-end">
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Página anterior"
                className="p-2.5 rounded-2xl bg-white border-2 border-slate-300 disabled:opacity-30 active:scale-95"
              >
                <ChevronLeft className="w-6 h-6 text-slate-700" />
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                aria-label="Página siguiente"
                className="p-2.5 rounded-2xl bg-white border-2 border-slate-300 disabled:opacity-30 active:scale-95"
              >
                <ChevronRight className="w-6 h-6 text-slate-700" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cuadrícula limpia 3 x 2 sin scroll */}
      {visibleSubjects.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-3xl border-[4px] border-slate-200 p-8 text-center text-slate-600 text-xl">
            No hay elementos activos en esta categoría todavía.
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-2 gap-5 max-w-6xl w-full mx-auto">
          {visibleSubjects.map((subject) => {
            const displayLabel = normalizePhrase([subject.article, subject.name]);
            return (
              <FitzgeraldCard
                key={subject.id}
                label={displayLabel}
                color={subject.fitzgeraldColor ?? 'orange'}
                imageMediaId={subject.imageMediaId}
                emojiFallback={subject.emojiFallback ?? '⭐'}
                size="md"
                onClick={() => handleTapSubject(subject)}
                className="w-full h-full"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
