import { Mp3Encoder } from '@breezystack/lamejs';
import { getUtf8ByteLength, MAX_MEDIA_BYTES } from './mediaCache';

export interface EncodedAudioResult {
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
}

export const MAX_RECORDING_SECONDS = 14;
const TARGET_MP3_SAMPLE_RATE = 22050;
const TARGET_MP3_KBPS = 48;

function downsampleMono(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number,
): Int16Array {
  if (inputSampleRate === targetSampleRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.max(1, Math.floor(input.length / ratio));
  const result = new Int16Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.min(input.length, Math.round((offsetResult + 1) * ratio));
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer; i++) {
      accum += input[i];
      count++;
    }
    const sample = count > 0 ? Math.max(-1, Math.min(1, accum / count)) : 0;
    result[offsetResult] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function encodePcmToMp3DataUrl(
  monoFloat32: Float32Array,
  inputSampleRate: number,
  kbps = TARGET_MP3_KBPS,
): EncodedAudioResult {
  const pcm16 = downsampleMono(monoFloat32, inputSampleRate, TARGET_MP3_SAMPLE_RATE);
  const encoder = new Mp3Encoder(1, TARGET_MP3_SAMPLE_RATE, kbps);

  const mp3Chunks: Uint8Array[] = [];
  const blockSize = 1152;

  for (let i = 0; i < pcm16.length; i += blockSize) {
    const sampleChunk = pcm16.subarray(i, i + blockSize);
    const encoded = encoder.encodeBuffer(sampleChunk);
    if (encoded.length > 0) {
      mp3Chunks.push(new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    mp3Chunks.push(new Uint8Array(flushed.buffer, flushed.byteOffset, flushed.byteLength));
  }

  const totalLength = mp3Chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const dataUrl = `data:audio/mpeg;base64,${uint8ArrayToBase64(merged)}`;
  const sizeBytes = getUtf8ByteLength(dataUrl);
  const durationSec = monoFloat32.length / inputSampleRate;

  if (sizeBytes >= MAX_MEDIA_BYTES) {
    throw new Error(
      `El audio MP3 supera el límite de 150 KB (${(sizeBytes / 1024).toFixed(1)} KB). Graba un audio más breve (máx. ~14 segundos).`,
    );
  }

  return {
    dataUrl,
    mimeType: 'audio/mpeg',
    sizeBytes,
    durationSec,
  };
}

export interface ActiveMp3Recording {
  stop: () => Promise<EncodedAudioResult>;
  cancel: () => void;
}

/**
 * Graba audio mono directamente desde Web Audio API y codifica a MP3 universal
 * con @breezystack/lamejs (evita audio/webm incompatible con Safari iPadOS).
 */
export async function startMp3Recording(callbacks?: {
  onTick?: (elapsedSec: number) => void;
  onAutoStop?: (result: EncodedAudioResult) => void;
  onError?: (err: Error) => void;
}): Promise<ActiveMp3Recording> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Tu navegador no permite grabar micrófono en este contexto (requiere HTTPS).');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioCtx) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('Web Audio API no disponible en este navegador.');
  }

  const audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;

  const chunks: Float32Array[] = [];
  let totalSamples = 0;
  let stopped = false;
  const startedAt = performance.now();

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const channelData = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(channelData.length);
    copy.set(channelData);
    chunks.push(copy);
    totalSamples += copy.length;
  };

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  const cleanup = () => {
    try {
      processor.disconnect();
      source.disconnect();
      silentGain.disconnect();
    } catch {
      // ignore
    }
    stream.getTracks().forEach((t) => t.stop());
    audioCtx.close().catch(() => undefined);
  };

  const finalize = async (): Promise<EncodedAudioResult> => {
    if (stopped) {
      throw new Error('La grabación ya fue detenida.');
    }
    stopped = true;
    window.clearInterval(tickTimer);
    cleanup();

    if (totalSamples === 0) {
      throw new Error('No se capturó sonido del micrófono. Revisa los permisos.');
    }

    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    return encodePcmToMp3DataUrl(merged, audioCtx.sampleRate, TARGET_MP3_KBPS);
  };

  const tickTimer = window.setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    callbacks?.onTick?.(Math.min(elapsed, MAX_RECORDING_SECONDS));
    if (elapsed >= MAX_RECORDING_SECONDS && !stopped) {
      finalize()
        .then((res) => callbacks?.onAutoStop?.(res))
        .catch((err) => callbacks?.onError?.(err instanceof Error ? err : new Error(String(err))));
    }
  }, 150);

  return {
    stop: finalize,
    cancel: () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(tickTimer);
      cleanup();
    },
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de audio.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Acepta archivos .mp3 o .m4a listos. Si exceden 150 KB, intenta recodificarlos a MP3 mono 48 kbps.
 */
export async function processUploadedAudioFile(file: File): Promise<EncodedAudioResult> {
  const nameLower = file.name.toLowerCase();
  const isMp3OrM4a =
    nameLower.endsWith('.mp3') ||
    nameLower.endsWith('.m4a') ||
    file.type === 'audio/mpeg' ||
    file.type === 'audio/mp4' ||
    file.type === 'audio/x-m4a';

  if (isMp3OrM4a) {
    const rawDataUrl = await readFileAsDataUrl(file);
    const rawBytes = getUtf8ByteLength(rawDataUrl);
    if (rawBytes < MAX_MEDIA_BYTES) {
      return {
        dataUrl: rawDataUrl,
        mimeType:
          file.type || (nameLower.endsWith('.m4a') ? 'audio/mp4' : 'audio/mpeg'),
        sizeBytes: rawBytes,
        durationSec: 0,
      };
    }
  }

  // Fallback: decodificar y recodificar a MP3 mono 48 kbps para garantizar compatibilidad Safari iOS y <150 KB
  const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('El archivo supera los 150 KB y este navegador no puede recomprimirlo.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    if (decoded.duration > 16) {
      throw new Error(
        `El audio dura ${decoded.duration.toFixed(1)}s. El máximo recomendado es 15 segundos (< 150 KB).`,
      );
    }

    // Mezclar a mono
    const length = decoded.length;
    const mono = new Float32Array(length);
    const channels = decoded.numberOfChannels;
    for (let ch = 0; ch < channels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += data[i] / channels;
      }
    }

    return encodePcmToMp3DataUrl(mono, decoded.sampleRate, TARGET_MP3_KBPS);
  } finally {
    ctx.close().catch(() => undefined);
  }
}
