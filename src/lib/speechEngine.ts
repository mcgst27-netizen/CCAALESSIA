import { getMediaById } from './mediaCache';
import type { OptionDoc, PredicateDoc, SubjectDoc } from '../types/caa';

const DEBOUNCE_MS = 150;
const WEBKIT_CANCEL_DELAY_MS = 60;
const SUBJECT_SOUND_PAUSE_MS = 150;
const WATCHDOG_BUFFER_MS = 2500;
const TTS_RATE = 0.9;

let sharedAudioCtx: AudioContext | null = null;
let currentBufferSource: AudioBufferSourceNode | null = null;
const decodedAudioCache = new Map<string, AudioBuffer>();

// Retención explícita a nivel de módulo para evitar recolección de basura prematura en Safari iPadOS
let activeUtterance: SpeechSynthesisUtterance | null = null;
let playbackToken = 0;
let lastTriggerTime = 0;
let activeTimers: number[] = [];
let cachedSpanishVoice: SpeechSynthesisVoice | null = null;
let isAudioUnlocked = false;

function getOrCreateAudioContext(): AudioContext | null {
  const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

/**
 * En iPadOS 17+ Safari, asigna audioSession.type = 'playback' para sonar
 * incluso cuando el interruptor de Modo Silencio (campana) está activado.
 */
export function configureAudioSessionPlayback(): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
      navigator.audioSession.type = 'playback';
      return true;
    }
  } catch {
    // Algunos navegadores ignoran o restringen el setter
  }
  return false;
}

function scoreSpanishVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase().replace('_', '-');
  const name = voice.name.toLowerCase();

  let score = 0;
  if (lang === 'es-pe') score += 100;
  else if (lang === 'es-419') score += 95;
  else if (lang === 'es-mx') score += 90;
  else if (lang === 'es-es') score += 85;
  else if (lang.startsWith('es')) score += 70;
  else return -1;

  if (voice.localService) score += 20;
  if (name.includes('enhanced') || name.includes('premium') || name.includes('siri')) score += 15;
  if (name.includes('paulina') || name.includes('mónica') || name.includes('monica') || name.includes('paloma')) {
    score += 12;
  }
  return score;
}

export function resolveSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return cachedSpanishVoice;

  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const voice of voices) {
    const score = scoreSpanishVoice(voice);
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  if (best) {
    cachedSpanishVoice = best;
  }
  return cachedSpanishVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    resolveSpanishVoice();
  };
}

/**
 * Desbloquea AudioContext y fuerza carga silenciosa de voces en el primer gesto táctil en iPadOS.
 */
export function unlockAudioForIOS(): void {
  configureAudioSessionPlayback();

  const ctx = getOrCreateAudioContext();
  if (ctx) {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    if (!isAudioUnlocked) {
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        // ignore
      }
    }
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    resolveSpanishVoice();
    if (!isAudioUnlocked) {
      try {
        const warm = new SpeechSynthesisUtterance('');
        warm.volume = 0;
        warm.lang = 'es-419';
        window.speechSynthesis.speak(warm);
      } catch {
        // ignore
      }
    }
  }

  isAudioUnlocked = true;
}

export function evictDecodedAudio(mediaId: string): void {
  decodedAudioCache.delete(mediaId);
}

function clearAllTimers(): void {
  for (const id of activeTimers) {
    window.clearTimeout(id);
  }
  activeTimers = [];
}

function scheduleTimer(fn: () => void, ms: number): number {
  const id = window.setTimeout(fn, ms);
  activeTimers.push(id);
  return id;
}

function sleep(ms: number, token: number): Promise<boolean> {
  return new Promise((resolve) => {
    scheduleTimer(() => resolve(token === playbackToken), ms);
  });
}

export function stopAllAudio(): void {
  playbackToken++;
  clearAllTimers();

  if (currentBufferSource) {
    try {
      currentBufferSource.onended = null;
      currentBufferSource.stop();
      currentBufferSource.disconnect();
    } catch {
      // ignore
    }
    currentBufferSource = null;
  }

  activeUtterance = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

function checkDebounce(): boolean {
  const now = performance.now();
  if (now - lastTriggerTime < DEBOUNCE_MS) {
    return false;
  }
  lastTriggerTime = now;
  return true;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getDecodedAudioBuffer(mediaId: string): Promise<AudioBuffer | null> {
  const existing = decodedAudioCache.get(mediaId);
  if (existing) return existing;

  const media = await getMediaById(mediaId);
  if (!media?.dataUrl) return null;

  const ctx = getOrCreateAudioContext();
  if (!ctx) return null;

  try {
    const buffer = dataUrlToArrayBuffer(media.dataUrl);
    const decoded = await ctx.decodeAudioData(buffer.slice(0));
    decodedAudioCache.set(mediaId, decoded);
    return decoded;
  } catch {
    return null;
  }
}

async function playMp3ByMediaId(mediaId: string, token: number): Promise<boolean> {
  configureAudioSessionPlayback();
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => undefined);
  }

  const audioBuffer = await getDecodedAudioBuffer(mediaId);
  if (!audioBuffer || token !== playbackToken) return false;

  return new Promise((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    currentBufferSource = source;

    const estimatedMs = Math.max(250, Math.round(audioBuffer.duration * 1000));
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (currentBufferSource === source) {
        currentBufferSource = null;
      }
      resolve(ok);
    };

    source.onended = () => finish(token === playbackToken);

    // Watchdog de respaldo
    scheduleTimer(() => finish(token === playbackToken), estimatedMs + WATCHDOG_BUFFER_MS);

    try {
      source.start(0);
    } catch {
      finish(false);
    }
  });
}

function estimateSpeechDurationMs(text: string): number {
  const clean = text.trim();
  if (!clean) return 350;
  // ~13 caracteres por segundo a rate 0.9 (~77 ms/carácter) + colchón de inicio
  return Math.max(550, Math.round(clean.length * 78 + 260));
}

export function normalizePhrase(parts: Array<string | undefined | null>): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function speakTextInternal(
  text: string,
  token: number,
  segmentTimings?: {
    segments: string[];
    slotIndices: Array<0 | 1 | 2>;
    onActiveSlotChange?: (slot: 0 | 1 | 2 | null) => void;
  },
): Promise<boolean> {
  const clean = normalizePhrase([text]);
  if (!clean || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  configureAudioSessionPlayback();

  // Pausa de seguridad WebKit de 60 ms tras cancel() para evitar TTS mudo en Safari iOS
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }

  const stillValid = await sleep(WEBKIT_CANCEL_DELAY_MS, token);
  if (!stillValid) return false;

  const estimatedMs = estimateSpeechDurationMs(clean);

  // Timers proporcionales a la longitud de cada segmento (no depende de onboundary en Safari iOS)
  if (segmentTimings && segmentTimings.segments.length > 0 && segmentTimings.onActiveSlotChange) {
    const weights = segmentTimings.segments.map((s) => Math.max(2, s.trim().length));
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let elapsed = 0;

    segmentTimings.slotIndices.forEach((slotIdx, idx) => {
      const triggerAt = Math.round((elapsed / totalWeight) * estimatedMs);
      elapsed += weights[idx] ?? 2;
      scheduleTimer(() => {
        if (token === playbackToken) {
          segmentTimings.onActiveSlotChange?.(slotIdx);
        }
      }, triggerAt);
    });
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = resolveSpanishVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'es-419';
    }
    utterance.rate = TTS_RATE;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Retención anti-GC en variable de módulo
    activeUtterance = utterance;
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (activeUtterance === utterance) {
        activeUtterance = null;
      }
      resolve(ok);
    };

    utterance.onend = () => finish(token === playbackToken);
    utterance.onerror = () => finish(false);

    // Watchdog timeout: limpia estado y resaltado si Safari omite onend
    scheduleTimer(() => {
      if (token === playbackToken) {
        segmentTimings?.onActiveSlotChange?.(null);
      }
      finish(token === playbackToken);
    }, estimatedMs + WATCHDOG_BUFFER_MS);

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finish(false);
    }
  });
}

/**
 * Prioridad 1: Tarjeta individual (MP3 vía AudioContext si existe audioMediaId; si no, TTS).
 */
export async function playSingleCard(params: {
  text: string;
  audioMediaId?: string | null;
  skipDebounce?: boolean;
}): Promise<void> {
  if (!params.skipDebounce && !checkDebounce()) return;
  unlockAudioForIOS();
  stopAllAudio();
  const token = playbackToken;

  if (params.audioMediaId) {
    const played = await playMp3ByMediaId(params.audioMediaId, token);
    if (played || token !== playbackToken) return;
  }

  await speakTextInternal(params.text, token);
}

/**
 * Tarjeta del Sujeto en ActivityScreen:
 * Reproduce su nombre (audioMediaId o TTS) y si tiene soundEffectMediaId,
 * espera 150 ms y dispara el MP3 del sonido real.
 */
export async function playSubjectCard(subject: SubjectDoc): Promise<void> {
  if (!checkDebounce()) return;
  unlockAudioForIOS();
  stopAllAudio();
  const token = playbackToken;

  const subjectText = normalizePhrase([subject.article, subject.name]);

  if (subject.audioMediaId) {
    const played = await playMp3ByMediaId(subject.audioMediaId, token);
    if (!played && token === playbackToken) {
      await speakTextInternal(subjectText, token);
    }
  } else {
    await speakTextInternal(subjectText, token);
  }

  if (token !== playbackToken) return;

  if (subject.soundEffectMediaId) {
    const ok = await sleep(SUBJECT_SOUND_PAUSE_MS, token);
    if (!ok) return;
    await playMp3ByMediaId(subject.soundEffectMediaId, token);
  }
}

export interface PlaySequenceParams {
  subject: SubjectDoc;
  predicate: PredicateDoc;
  option: OptionDoc;
  customPhraseOverride?: string;
  onActiveSlotChange?: (slot: 0 | 1 | 2 | null) => void;
}

/**
 * Reproducción inteligente de la Barra de Frase (Casos A, B y C).
 */
export async function playSequence(params: PlaySequenceParams): Promise<void> {
  if (!checkDebounce()) return;
  unlockAudioForIOS();
  stopAllAudio();
  const token = playbackToken;
  const { subject, predicate, option, customPhraseOverride, onActiveSlotChange } = params;

  const subjectText = normalizePhrase([subject.article, subject.name]);
  const predicateText = normalizePhrase([predicate.label]);
  const optionSpokenText = normalizePhrase([option.spokenLabel || option.label]);

  try {
    // CASO A: Pregunta de sonido real (optionType === "sound" y la opción tiene MP3)
    if (predicate.optionType === 'sound' && option.audioMediaId) {
      if (subject.audioMediaId && predicate.audioMediaId) {
        onActiveSlotChange?.(0);
        await playMp3ByMediaId(subject.audioMediaId, token);
        if (token !== playbackToken) return;

        onActiveSlotChange?.(1);
        await playMp3ByMediaId(predicate.audioMediaId, token);
        if (token !== playbackToken) return;
      } else {
        const introText = normalizePhrase([subjectText, predicateText]);
        await speakTextInternal(introText, token, {
          segments: [subjectText, predicateText],
          slotIndices: [0, 1],
          onActiveSlotChange,
        });
        if (token !== playbackToken) return;
      }

      const pauseOk = await sleep(100, token);
      if (!pauseOk) return;

      onActiveSlotChange?.(2);
      await playMp3ByMediaId(option.audioMediaId, token);
      if (token === playbackToken) {
        onActiveSlotChange?.(null);
      }
      return;
    }

    // CASO B: Las 3 piezas tienen audioMediaId grabado manualmente
    if (subject.audioMediaId && predicate.audioMediaId && option.audioMediaId) {
      onActiveSlotChange?.(0);
      await playMp3ByMediaId(subject.audioMediaId, token);
      if (token !== playbackToken) return;

      onActiveSlotChange?.(1);
      await playMp3ByMediaId(predicate.audioMediaId, token);
      if (token !== playbackToken) return;

      onActiveSlotChange?.(2);
      await playMp3ByMediaId(option.audioMediaId, token);
      if (token === playbackToken) {
        onActiveSlotChange?.(null);
      }
      return;
    }

    // CASO C: Regla general -> 1 sola llamada fluida de TTS con timers proporcionales 0 -> 1 -> 2
    const fullSentence =
      customPhraseOverride && customPhraseOverride.trim().length > 0
        ? normalizePhrase([customPhraseOverride])
        : normalizePhrase([subjectText, predicateText, optionSpokenText]);

    await speakTextInternal(fullSentence, token, {
      segments: [subjectText, predicateText, optionSpokenText],
      slotIndices: [0, 1, 2],
      onActiveSlotChange,
    });

    if (token === playbackToken) {
      onActiveSlotChange?.(null);
    }
  } finally {
    if (token === playbackToken) {
      onActiveSlotChange?.(null);
    }
  }
}

export interface AudioDiagnosticReport {
  voiceName: string;
  voiceLang: string;
  audioSessionSupported: boolean;
  audioContextState: string;
}

export async function runAudioDiagnostic(): Promise<AudioDiagnosticReport> {
  unlockAudioForIOS();
  const audioSessionSupported = configureAudioSessionPlayback();
  const voice = resolveSpanishVoice();
  const ctx = getOrCreateAudioContext();

  await playSingleCard({
    text: 'Hola, la voz del iPad funciona correctamente.',
    skipDebounce: true,
  });

  return {
    voiceName: voice ? voice.name : 'Voz predeterminada del sistema',
    voiceLang: voice ? voice.lang : 'es-419',
    audioSessionSupported,
    audioContextState: ctx ? ctx.state : 'no-disponible',
  };
}
