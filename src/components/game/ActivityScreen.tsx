import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import {
  getNextRotatedPredicateId,
  saveLastPredicateForSubject,
} from '../../lib/rotationStore';
import {
  normalizePhrase,
  playSequence,
  playSingleCard,
  playSubjectCard,
  stopAllAudio,
} from '../../lib/speechEngine';
import type { AppConfig, OptionDoc, PredicateDoc, SubjectDoc } from '../../types/caa';
import { FitzgeraldCard } from '../common/FitzgeraldCard';
import { SentenceStrip } from './SentenceStrip';

const BACK_HOLD_MS = 1000;

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface ActivityScreenProps {
  subject: SubjectDoc;
  predicates: PredicateDoc[];
  options: OptionDoc[];
  config: AppConfig;
  onBack: () => void;
}

export function ActivityScreen({
  subject,
  predicates,
  options,
  config,
  onBack,
}: ActivityScreenProps) {
  // Predicados asignados a este sujeto que tienen al menos 1 opción asociada
  const subjectPredicates = useMemo(() => {
    const assignedIds = Object.entries(subject.relations ?? {})
      .filter(([, rel]) => Array.isArray(rel?.targetOptionIds) && rel.targetOptionIds.length > 0)
      .map(([predId]) => predId);

    return predicates.filter((p) => assignedIds.includes(p.id));
  }, [subject, predicates]);

  const [activePredicateId, setActivePredicateId] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<OptionDoc | null>(null);
  const [activeSlot, setActiveSlot] = useState<0 | 1 | 2 | null>(null);
  const [roundNonce, setRoundNonce] = useState(0);

  // Estado opcional de pulsación de 1s en botón "Volver"
  const [backHoldProgress, setBackHoldProgress] = useState(0);
  const backRafRef = useRef<number | null>(null);
  const backStartRef = useRef<number | null>(null);

  const resetBackHold = useCallback(() => {
    if (backRafRef.current !== null) {
      cancelAnimationFrame(backRafRef.current);
      backRafRef.current = null;
    }
    backStartRef.current = null;
    setBackHoldProgress(0);
  }, []);

  useEffect(() => {
    return () => {
      resetBackHold();
      stopAllAudio();
    };
  }, [resetBackHold]);

  // Al entrar a un sujeto, rotación inteligente automática al siguiente predicado disponible
  useEffect(() => {
    const ids = subjectPredicates.map((p) => p.id);
    const nextId = getNextRotatedPredicateId(subject.id, ids);
    setActivePredicateId(nextId);
    if (nextId) {
      saveLastPredicateForSubject(subject.id, nextId);
    }
    setSelectedOption(null);
    setActiveSlot(null);
    setRoundNonce((n) => n + 1);
  }, [subject.id, subjectPredicates]);

  const activePredicate = useMemo(
    () => subjectPredicates.find((p) => p.id === activePredicateId) ?? null,
    [subjectPredicates, activePredicateId],
  );

  const activeRelation = activePredicate ? subject.relations[activePredicate.id] : undefined;

  // Construcción inteligente y barajada de las 3 o 4 opciones de la ronda
  const roundOptions = useMemo(() => {
    if (!activePredicate || !activeRelation) return [];
    const targetIds = activeRelation.targetOptionIds ?? [];
    const targetOptions = options.filter((o) => targetIds.includes(o.id));
    if (targetOptions.length === 0) return [];

    // 1 respuesta asociada al azar entre las configuradas para este sujeto+predicado
    const chosenTarget =
      targetOptions[Math.floor(Math.random() * targetOptions.length)];

    // Distractores aleatorios del mismo optionType (sin repetir ni mezclar otros targets del mismo verbo)
    const distractorPool = shuffleArray(
      options.filter(
        (o) =>
          o.optionType === activePredicate.optionType &&
          !targetIds.includes(o.id),
      ),
    );

    const maxOptions = Math.min(4, Math.max(3, config.optionsPerRound ?? 3));
    const selected = [chosenTarget, ...distractorPool.slice(0, maxOptions - 1)];

    // Si el banco del mismo optionType es muy pequeño, rellenar con otras targets no repetidas si hubiera
    if (selected.length < maxOptions) {
      for (const extra of targetOptions) {
        if (selected.length >= maxOptions) break;
        if (!selected.some((s) => s.id === extra.id)) {
          selected.push(extra);
        }
      }
    }

    return shuffleArray(selected);
    // roundNonce fuerza barajado limpio en cada cambio de pregunta o sujeto
  }, [activePredicate, activeRelation, options, config.optionsPerRound, roundNonce]);

  const handleSelectPredicate = (predicate: PredicateDoc) => {
    setActivePredicateId(predicate.id);
    saveLastPredicateForSubject(subject.id, predicate.id);
    setSelectedOption(null);
    setActiveSlot(null);
    setRoundNonce((n) => n + 1);
    playSingleCard({
      text: predicate.label,
      audioMediaId: predicate.audioMediaId,
    }).catch(() => undefined);
  };

  const handleNextPredicate = () => {
    if (subjectPredicates.length <= 1 || !activePredicate) return;
    const idx = subjectPredicates.findIndex((p) => p.id === activePredicate.id);
    const next = subjectPredicates[(idx + 1) % subjectPredicates.length];
    handleSelectPredicate(next);
  };

  const triggerSentencePlayback = (option: OptionDoc) => {
    if (!activePredicate) return;
    const isTargetOption = (activeRelation?.targetOptionIds ?? []).includes(option.id);
    const override = isTargetOption ? activeRelation?.customPhraseOverride : undefined;

    playSequence({
      subject,
      predicate: activePredicate,
      option,
      customPhraseOverride: override,
      onActiveSlotChange: (slot) => setActiveSlot(slot),
    }).catch(() => undefined);
  };

  const handleTapOption = (option: OptionDoc) => {
    setSelectedOption(option);
    triggerSentencePlayback(option);
  };

  const handleBackPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!config.holdBackButtonInActivity) {
      stopAllAudio();
      onBack();
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resetBackHold();
    backStartRef.current = performance.now();

    const tick = (now: number) => {
      if (backStartRef.current === null) return;
      const ratio = Math.min(1, (now - backStartRef.current) / BACK_HOLD_MS);
      setBackHoldProgress(ratio);
      if (ratio >= 1) {
        resetBackHold();
        stopAllAudio();
        onBack();
        return;
      }
      backRafRef.current = requestAnimationFrame(tick);
    };
    backRafRef.current = requestAnimationFrame(tick);
  };

  const subjectDisplayLabel = normalizePhrase([subject.article, subject.name]);

  return (
    <div className="caa-game-surface h-[100dvh] w-screen overflow-hidden flex flex-col bg-[#F8FAFC] p-4 md:p-5 gap-4">
      {/* ZONA SUPERIOR: Botón Volver + Barra de Frase */}
      <div className="flex items-center gap-3 pr-14 shrink-0">
        <button
          type="button"
          onPointerDown={handleBackPointerDown}
          onPointerUp={resetBackHold}
          onPointerCancel={resetBackHold}
          onPointerLeave={resetBackHold}
          onContextMenu={(e) => e.preventDefault()}
          title={
            config.holdBackButtonInActivity
              ? 'Mantén presionado 1 segundo para volver'
              : 'Volver'
          }
          className="relative overflow-hidden inline-flex items-center gap-2 px-5 py-3 min-h-[56px] shrink-0 rounded-2xl bg-white border-[3px] border-slate-300 text-slate-800 text-lg md:text-xl font-bold shadow-sm active:scale-95 transition-transform select-none"
        >
          {config.holdBackButtonInActivity && backHoldProgress > 0 && (
            <span
              className="absolute inset-y-0 left-0 bg-slate-200/80 pointer-events-none"
              style={{ width: `${Math.round(backHoldProgress * 100)}%` }}
            />
          )}
          <ArrowLeft className="w-6 h-6 relative z-10" />
          <span className="relative z-10">Volver</span>
        </button>

        <SentenceStrip
          subject={subject}
          predicate={activePredicate}
          selectedOption={selectedOption}
          activeSlot={activeSlot}
          onReplaySentence={() => {
            if (selectedOption) triggerSentencePlayback(selectedOption);
          }}
          onClearOption={() => {
            stopAllAudio();
            setSelectedOption(null);
            setActiveSlot(null);
          }}
        />
      </div>

      {/* ZONA PRINCIPAL: 3 Columnas Limpias sin Scroll */}
      {subjectPredicates.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-3xl border-[4px] border-slate-200 p-8 text-center max-w-lg text-slate-600 text-xl">
            Este elemento aún no tiene preguntas/verbos asignados. Agrégalos desde el Modo Edición.
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-5 items-stretch">
          {/* COLUMNA IZQUIERDA: Sujeto */}
          <div className="col-span-4 flex flex-col justify-center">
            <FitzgeraldCard
              label={subjectDisplayLabel}
              color={subject.fitzgeraldColor ?? 'orange'}
              imageMediaId={subject.imageMediaId}
              emojiFallback={subject.emojiFallback ?? '⭐'}
              size="xl"
              highlighted={activeSlot === 0}
              onClick={() => {
                playSubjectCard(subject).catch(() => undefined);
              }}
              className="w-full h-full max-h-[430px]"
            />
          </div>

          {/* COLUMNA CENTRAL: Verbo(s) / Predicado */}
          <div className="col-span-3 flex flex-col justify-center gap-3 min-h-0">
            {config.showAllPredicatesMode ? (
              <div className="flex-1 min-h-0 flex flex-col justify-center gap-2.5">
                {subjectPredicates.map((pred) => {
                  const isCurrent = pred.id === activePredicate?.id;
                  return (
                    <FitzgeraldCard
                      key={pred.id}
                      label={pred.label}
                      color="green"
                      imageMediaId={pred.imageMediaId}
                      emojiFallback={pred.emojiFallback ?? '💬'}
                      size="sm"
                      highlighted={isCurrent && activeSlot === 1}
                      dimmed={!isCurrent}
                      onClick={() => handleSelectPredicate(pred)}
                      className={[
                        'w-full flex-1',
                        isCurrent ? 'ring-4 ring-green-200' : '',
                      ].join(' ')}
                    />
                  );
                })}
              </div>
            ) : (
              activePredicate && (
                <div className="flex flex-col items-center justify-center gap-3 h-full">
                  <FitzgeraldCard
                    label={activePredicate.label}
                    sublabel={activePredicate.questionPrompt}
                    color="green"
                    imageMediaId={activePredicate.imageMediaId}
                    emojiFallback={activePredicate.emojiFallback ?? '💬'}
                    size="lg"
                    highlighted={activeSlot === 1}
                    onClick={() => {
                      playSingleCard({
                        text: activePredicate.label,
                        audioMediaId: activePredicate.audioMediaId,
                      }).catch(() => undefined);
                    }}
                    className="w-full flex-1 max-h-[340px]"
                  />

                  {subjectPredicates.length > 1 && (
                    <button
                      type="button"
                      onClick={handleNextPredicate}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white border-2 border-slate-200 text-slate-600 text-base font-semibold shadow-sm active:scale-95 transition-transform"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Siguiente pregunta
                    </button>
                  )}
                </div>
              )
            )}
          </div>

          {/* COLUMNA DERECHA: 3 o 4 Opciones Barajadas (Modo Modelado sin Error) */}
          <div className="col-span-5 flex flex-col justify-center min-h-0">
            <div
              className={[
                'grid gap-4 h-full max-h-[500px]',
                roundOptions.length >= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1 grid-rows-3',
              ].join(' ')}
            >
              {roundOptions.map((opt) => {
                const isTarget = (activeRelation?.targetOptionIds ?? []).includes(opt.id);
                const shouldDim =
                  Boolean(config.visualPromptDimDistractors) && !isTarget;
                const isSpeakingThis =
                  activeSlot === 2 && selectedOption?.id === opt.id;

                return (
                  <FitzgeraldCard
                    key={opt.id}
                    label={opt.label}
                    color={opt.fitzgeraldColor}
                    imageMediaId={opt.imageMediaId}
                    emojiFallback={opt.emojiFallback ?? '✨'}
                    size={roundOptions.length >= 4 ? 'md' : 'md'}
                    highlighted={isSpeakingThis}
                    dimmed={shouldDim}
                    onClick={() => handleTapOption(opt)}
                    className={[
                      'w-full h-full',
                      roundOptions.length < 4 ? 'flex-row justify-start px-6 gap-6 text-left' : '',
                    ].join(' ')}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
