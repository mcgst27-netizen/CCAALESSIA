import { getUtf8ByteLength, MAX_MEDIA_BYTES } from './mediaCache';

export interface CompressedImageResult {
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

const MAX_DIMENSION = 450;
const SOFT_TARGET_BYTES = 145 * 1024;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen seleccionada.'));
    };
    img.src = objectUrl;
  });
}

function renderToDataUrl(
  img: HTMLImageElement,
  maxDim: number,
  quality: number,
  mimeType: 'image/jpeg' | 'image/webp',
): { dataUrl: string; width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Tu navegador no soporta compresión por Canvas.');
  }

  // Fondo blanco limpio para evitar transparencias negras al convertir PNG a JPEG
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL(mimeType, quality);
  return { dataUrl, width, height };
}

export async function compressImageFile(file: File): Promise<CompressedImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecciona un archivo de imagen válido (JPG, PNG, WebP o foto del iPad).');
  }

  const img = await loadImageFromFile(file);

  // Intentamos JPEG 0.75 a máx 450x450px (universal en iPadOS Safari + Windows)
  const attempts: Array<{ maxDim: number; quality: number; mime: 'image/jpeg' | 'image/webp' }> = [
    { maxDim: MAX_DIMENSION, quality: 0.75, mime: 'image/jpeg' },
    { maxDim: MAX_DIMENSION, quality: 0.62, mime: 'image/jpeg' },
    { maxDim: 380, quality: 0.58, mime: 'image/jpeg' },
    { maxDim: 320, quality: 0.52, mime: 'image/jpeg' },
  ];

  let best: CompressedImageResult | null = null;

  for (const attempt of attempts) {
    const { dataUrl, width, height } = renderToDataUrl(
      img,
      attempt.maxDim,
      attempt.quality,
      attempt.mime,
    );
    const sizeBytes = getUtf8ByteLength(dataUrl);
    best = { dataUrl, mimeType: attempt.mime, sizeBytes, width, height };
    if (sizeBytes <= SOFT_TARGET_BYTES) {
      return best;
    }
  }

  if (!best || best.sizeBytes >= MAX_MEDIA_BYTES) {
    throw new Error(
      `La imagen comprimida aún supera 150 KB (${best ? (best.sizeBytes / 1024).toFixed(1) : '?'} KB). Prueba con otra foto más simple.`,
    );
  }

  return best;
}
