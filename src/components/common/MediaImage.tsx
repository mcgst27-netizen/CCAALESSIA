import { useEffect, useState } from 'react';
import { getMediaById } from '../../lib/mediaCache';

interface MediaImageProps {
  mediaId: string | null | undefined;
  emojiFallback?: string;
  alt: string;
  className?: string;
  emojiClassName?: string;
  fit?: 'contain' | 'cover';
}

export function MediaImage({
  mediaId,
  emojiFallback = '🖼️',
  alt,
  className = 'w-full h-full',
  emojiClassName = 'text-6xl',
  fit = 'contain',
}: MediaImageProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!mediaId) {
      setSrc(null);
      return;
    }

    getMediaById(mediaId)
      .then((doc) => {
        if (!cancelled) {
          setSrc(doc?.dataUrl ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`${className} ${fit === 'cover' ? 'object-cover' : 'object-contain'} rounded-2xl`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={alt}
      className={`select-none leading-none flex items-center justify-center ${emojiClassName}`}
    >
      {emojiFallback}
    </span>
  );
}
