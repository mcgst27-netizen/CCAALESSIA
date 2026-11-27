import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';

const HOLD_DURATION_MS = 3000;
const RING_RADIUS = 18;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface ChildLockButtonProps {
  onUnlock: () => void;
}

export function ChildLockButton({ onUnlock }: ChildLockButtonProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  const reset = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startTimeRef.current = null;
    triggeredRef.current = false;
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    reset();
    startTimeRef.current = performance.now();

    const step = (now: number) => {
      if (startTimeRef.current === null || triggeredRef.current) return;
      const elapsed = now - startTimeRef.current;
      const ratio = Math.min(1, elapsed / HOLD_DURATION_MS);
      setProgress(ratio);

      if (ratio >= 1) {
        triggeredRef.current = true;
        rafRef.current = null;
        setProgress(0);
        onUnlock();
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  };

  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <button
      type="button"
      aria-label="Mantener presionado 3 segundos para modo edición"
      title="Mantén presionado 3 segundos para abrir el modo edición"
      onPointerDown={handlePointerDown}
      onPointerUp={reset}
      onPointerCancel={reset}
      onPointerLeave={reset}
      onContextMenu={(e) => e.preventDefault()}
      className={[
        'fixed top-3 right-3 z-40 w-12 h-12 rounded-full flex items-center justify-center transition-opacity select-none touch-none',
        progress > 0 ? 'opacity-95 bg-white shadow-md' : 'opacity-30 hover:opacity-50',
      ].join(' ')}
    >
      <svg className="absolute inset-0 w-12 h-12 -rotate-90" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          fill="none"
          stroke="#CBD5E1"
          strokeWidth="3.5"
          opacity={progress > 0 ? 1 : 0}
        />
        <circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          fill="none"
          stroke="#0F172A"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          opacity={progress > 0 ? 1 : 0}
        />
      </svg>
      <Lock className="w-5 h-5 text-slate-700 relative z-10" />
    </button>
  );
}
