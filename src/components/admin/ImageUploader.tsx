import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { compressImageFile } from '../../lib/imageCompressor';
import { getMediaById, saveMediaDoc } from '../../lib/mediaCache';
import { MediaImage } from '../common/MediaImage';

interface ImageUploaderProps {
  label?: string;
  imageMediaId: string | null;
  emojiFallback?: string;
  onChange: (nextMediaId: string | null, removedMediaId?: string) => void;
}

export function ImageUploader({
  label = 'Fotografía',
  imageMediaId,
  emojiFallback = '🖼️',
  onChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [sizeKb, setSizeKb] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!imageMediaId) {
      setSizeKb(null);
      return;
    }
    getMediaById(imageMediaId)
      .then((m) => {
        if (!cancelled && m) {
          setSizeKb(Number((m.sizeBytes / 1024).toFixed(1)));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [imageMediaId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setBusy(true);
    try {
      const compressed = await compressImageFile(file);
      const saved = await saveMediaDoc({
        kind: 'image',
        mimeType: compressed.mimeType,
        dataUrl: compressed.dataUrl,
      });
      setSizeKb(Number((saved.sizeBytes / 1024).toFixed(1)));
      onChange(saved.id, imageMediaId ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la imagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = () => {
    if (!imageMediaId) return;
    onChange(null, imageMediaId);
    setSizeKb(null);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      <div className="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 bg-slate-50">
        <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
          <MediaImage
            mediaId={imageMediaId}
            emojiFallback={emojiFallback}
            alt={label}
            emojiClassName="text-4xl"
          />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-xs text-slate-500">
            {imageMediaId ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                Foto comprimida lista {sizeKb !== null ? `(${sizeKb} KB)` : ''}
              </span>
            ) : (
              <span>Sin foto (usando ícono de apoyo). Máx. 450×450 px (&lt; 150 KB).</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              {busy ? 'Comprimiendo...' : imageMediaId ? 'Cambiar foto' : 'Subir / Tomar foto'}
            </button>

            {imageMediaId && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100"
              >
                <Trash2 className="w-4 h-4" />
                Quitar foto
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>
      </div>
    </div>
  );
}
