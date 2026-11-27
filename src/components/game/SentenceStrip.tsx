import { Volume2, X } from 'lucide-react';
import { normalizePhrase } from '../../lib/speechEngine';
import type { FitzgeraldColor, OptionDoc, PredicateDoc, SubjectDoc } from '../../types/caa';
import { MediaImage } from '../common/MediaImage';

const SLOT_BORDER: Record<FitzgeraldColor, string> = {
  orange: 'border-[#F97316]',
  yellow: 'border-[#EAB308]',
  green: 'border-[#22C55E]',
  blue: 'border-[#3B82F6]',
  purple: 'border-[#A855F7]',
};

const SLOT_ACTIVE_BG: Record<FitzgeraldColor, string> = {
  orange: 'bg-orange-100 ring-4 ring-orange-300 scale-[1.03]',
  yellow: 'bg-yellow-100 ring-4 ring-yellow-300 scale-[1.03]',
  green: 'bg-green-100 ring-4 ring-green-300 scale-[1.03]',
  blue: 'bg-blue-100 ring-4 ring-blue-300 scale-[1.03]',
  purple: 'bg-purple-100 ring-4 ring-purple-300 scale-[1.03]',
};

interface SentenceStripProps {
  subject: SubjectDoc;
  predicate: PredicateDoc | null;
  selectedOption: OptionDoc | null;
  activeSlot: 0 | 1 | 2 | null;
  onReplaySentence: () => void;
  onClearOption: () => void;
}

export function SentenceStrip({
  subject,
  predicate,
  selectedOption,
  activeSlot,
  onReplaySentence,
  onClearOption,
}: SentenceStripProps) {
  const subjectLabel = normalizePhrase([subject.article, subject.name]);
  const subjectColor: FitzgeraldColor = subject.fitzgeraldColor ?? 'orange';
  const canSpeak = Boolean(predicate && selectedOption);

  return (
    <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (canSpeak) onReplaySentence();
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && canSpeak) {
            e.preventDefault();
            onReplaySentence();
          }
        }}
        aria-label="Barra de frase"
        className={[
          'flex items-center gap-2.5 md:gap-3 bg-white border-[3px] border-slate-200 rounded-3xl px-3.5 py-2.5 shadow-sm transition-all max-w-full',
          canSpeak ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default',
        ].join(' ')}
      >
        {/* Ranura 0: Sujeto */}
        <div
          className={[
            'flex items-center gap-2 px-3 py-1.5 rounded-2xl border-[4px] bg-white transition-all duration-150',
            SLOT_BORDER[subjectColor],
            activeSlot === 0 ? SLOT_ACTIVE_BG[subjectColor] : '',
          ].join(' ')}
        >
          <div className="w-10 h-10 shrink-0 flex items-center justify-center overflow-hidden">
            <MediaImage
              mediaId={subject.imageMediaId}
              emojiFallback={subject.emojiFallback ?? '⭐'}
              alt={subjectLabel}
              emojiClassName="text-2xl"
            />
          </div>
          <span className="text-lg md:text-xl font-extrabold text-slate-800 whitespace-nowrap">
            {subjectLabel}
          </span>
        </div>

        <span className="text-slate-300 font-bold text-xl select-none">+</span>

        {/* Ranura 1: Verbo / Predicado */}
        {predicate ? (
          <div
            className={[
              'flex items-center gap-2 px-3 py-1.5 rounded-2xl border-[4px] bg-white transition-all duration-150',
              SLOT_BORDER.green,
              activeSlot === 1 ? SLOT_ACTIVE_BG.green : '',
            ].join(' ')}
          >
            <div className="w-10 h-10 shrink-0 flex items-center justify-center overflow-hidden">
              <MediaImage
                mediaId={predicate.imageMediaId}
                emojiFallback={predicate.emojiFallback ?? '💬'}
                alt={predicate.label}
                emojiClassName="text-2xl"
              />
            </div>
            <span className="text-lg md:text-xl font-extrabold text-slate-800 whitespace-nowrap">
              {predicate.label}
            </span>
          </div>
        ) : (
          <div className="h-[56px] min-w-[120px] rounded-2xl border-[3px] border-dashed border-slate-300 flex items-center justify-center px-3 text-slate-400 font-semibold">
            ...
          </div>
        )}

        <span className="text-slate-300 font-bold text-xl select-none">+</span>

        {/* Ranura 2: Opción elegida */}
        {selectedOption ? (
          <div
            className={[
              'flex items-center gap-2 px-3 py-1.5 rounded-2xl border-[4px] bg-white transition-all duration-150',
              SLOT_BORDER[selectedOption.fitzgeraldColor],
              activeSlot === 2 ? SLOT_ACTIVE_BG[selectedOption.fitzgeraldColor] : '',
            ].join(' ')}
          >
            <div className="w-10 h-10 shrink-0 flex items-center justify-center overflow-hidden">
              <MediaImage
                mediaId={selectedOption.imageMediaId}
                emojiFallback={selectedOption.emojiFallback ?? '✨'}
                alt={selectedOption.label}
                emojiClassName="text-2xl"
              />
            </div>
            <span className="text-lg md:text-xl font-extrabold text-slate-800 whitespace-nowrap">
              {selectedOption.label}
            </span>
          </div>
        ) : (
          <div className="h-[56px] min-w-[130px] rounded-2xl border-[3px] border-dashed border-slate-300 bg-slate-50/80 flex items-center justify-center px-4 text-slate-400 text-base font-semibold">
            Elige aquí
          </div>
        )}

        {canSpeak && (
          <div className="pl-1 text-slate-500 flex items-center" aria-hidden="true">
            <Volume2 className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* Botón discreto para limpiar opción y armar otra frase */}
      {selectedOption && (
        <button
          type="button"
          onClick={onClearOption}
          aria-label="Limpiar opción elegida"
          title="Limpiar opción"
          className="w-12 h-12 shrink-0 rounded-2xl bg-white border-2 border-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
        >
          <X className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
