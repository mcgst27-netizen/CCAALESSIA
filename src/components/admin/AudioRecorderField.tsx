import { useEffect, useRef, useState } from 'react';
import { Mic, Play, RotateCcw, Square, Upload, Volume2 } from 'lucide-react';
import { getMediaById, saveMediaDoc } from '../../lib/mediaCache';
import {
  MAX_RECORDING_SECONDS,
  processUploadedAudioFile,
  startMp3Recording,
  type ActiveMp3Recording,
} from '../../lib/mp3Recorder';
import { playSingleCard } from '../../lib/speechEngine';

interface AudioRecorderFieldProps {
  label?: string;
  previewText: string;
  audioMediaId: string | null;
  isSoundEffect?: boolean;
  onChange: (nextMediaId: string | null, removedMediaId?: string) => void;
}

export function AudioRecorderField({
  label = 'Audio / Voz',
  previewText,
  audioMediaId,
  isSoundEffect = false,
  onChange,
}: AudioRecorderFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<ActiveMp3Recording | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [sizeKb, setSizeKb] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!audioMediaId) {
      setSizeKb(null);
      return;
    }
    getMediaById(audioMediaId)
      .then((m) => {
        if (!cancelled && m) {
          setSizeKb(Number((m.sizeBytes / 1024).toFixed(1)));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [audioMediaId]);

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
    };
  }, []);

  const persistEncodedAudio = async (dataUrl: string, mimeType: string) => {
    const saved = await saveMediaDoc({
      kind: 'audio',
      mimeType,
      dataUrl,
    });
    setSizeKb(Number((saved.sizeBytes / 1024).toFixed(1)));
    onChange(saved.id, audioMediaId ?? undefined);
  };

  const handleStartRecording = async () => {
    setError(null);
    setElapsedSec(0);
    try {
      const rec = await startMp3Recording({
        onTick: (sec) => setElapsedSec(sec),
        onAutoStop: async (result) => {
          recorderRef.current = null;
          setIsRecording(false);
          setProcessing(true);
          try {
            await persistEncodedAudio(result.dataUrl, result.mimeType);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error guardando el MP3.');
          } finally {
            setProcessing(false);
          }
        },
        onError: (err) => {
          recorderRef.current = null;
          setIsRecording(false);
          setError(err.message);
        },
      });
      recorderRef.current = rec;
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el micrófono.');
    }
  };

  const handleStopRecording = async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    recorderRef.current = null;
    setIsRecording(false);
    setProcessing(true);
    setError(null);
    try {
      const result = await rec.stop();
      await persistEncodedAudio(result.dataUrl, result.mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo codificar el audio a MP3.');
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setProcessing(true);
    try {
      const result = await processUploadedAudioFile(file);
      await persistEncodedAudio(result.dataUrl, result.mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el archivo de audio.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveAudio = () => {
    if (!audioMediaId) return;
    onChange(null, audioMediaId);
    setSizeKb(null);
  };

  const handlePreview = () => {
    playSingleCard({
      text: previewText.trim() || 'Prueba de voz',
      audioMediaId,
      skipDebounce: true,
    }).catch(() => undefined);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>

      <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
        {/* Estado actual claro */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {audioMediaId ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Volume2 className="w-4 h-4 shrink-0" />
              <span>
                Audio MP3 personalizado {sizeKb !== null ? `(${sizeKb} KB)` : ''}
              </span>
            </div>
          ) : isSoundEffect ? (
            <div className="text-sm text-slate-500">
              Sin efecto de sonido (opcional — ej. rugido del animal)
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Volume2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Usando voz automática del iPad (0 KB)</span>
            </div>
          )}

          {/* Botón de prueba inmediata */}
          {(!isSoundEffect || audioMediaId) && (
            <button
              type="button"
              disabled={isRecording || processing}
              onClick={handlePreview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {audioMediaId ? 'Escuchar MP3' : 'Probar voz'}
            </button>
          )}
        </div>

        {/* Controles secundarios limpios: Grabar MP3 o Subir .mp3/.m4a */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/80">
          {!isRecording ? (
            <button
              type="button"
              disabled={processing}
              onClick={handleStartRecording}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
            >
              <Mic className="w-3.5 h-3.5 text-rose-600" />
              {processing ? 'Codificando MP3...' : 'Grabar mi voz (MP3)'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopRecording}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 animate-pulse"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Detener ({elapsedSec.toFixed(1)}s / {MAX_RECORDING_SECONDS}s)
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a"
            onChange={handleUploadFile}
            className="hidden"
          />
          <button
            type="button"
            disabled={isRecording || processing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Subir archivo (.mp3 / .m4a)
          </button>

          {audioMediaId && (
            <button
              type="button"
              disabled={isRecording || processing}
              onClick={handleRemoveAudio}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isSoundEffect
                ? 'Quitar sonido'
                : 'Quitar audio y volver a voz del iPad'}
            </button>
          )}
        </div>

        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      </div>
    </div>
  );
}
