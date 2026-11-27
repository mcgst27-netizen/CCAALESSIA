import type { FitzgeraldColor } from '../../types/caa';
import { MediaImage } from './MediaImage';

const BORDER_STYLES: Record<FitzgeraldColor, string> = {
  orange: 'border-[#F97316]',
  yellow: 'border-[#EAB308]',
  green: 'border-[#22C55E]',
  blue: 'border-[#3B82F6]',
  purple: 'border-[#A855F7]',
};

const HIGHLIGHT_STYLES: Record<FitzgeraldColor, string> = {
  orange: 'ring-4 ring-orange-300 bg-orange-50/70',
  yellow: 'ring-4 ring-yellow-300 bg-yellow-50/70',
  green: 'ring-4 ring-green-300 bg-green-50/70',
  blue: 'ring-4 ring-blue-300 bg-blue-50/70',
  purple: 'ring-4 ring-purple-300 bg-purple-50/70',
};

interface FitzgeraldCardProps {
  label: string;
  sublabel?: string;
  color: FitzgeraldColor;
  imageMediaId: string | null | undefined;
  emojiFallback?: string;
  onClick?: () => void;
  highlighted?: boolean;
  dimmed?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function FitzgeraldCard({
  label,
  sublabel,
  color,
  imageMediaId,
  emojiFallback,
  onClick,
  highlighted = false,
  dimmed = false,
  size = 'md',
  className = '',
}: FitzgeraldCardProps) {
  const sizeConfig = {
    sm: {
      padding: 'p-2.5 gap-1.5',
      imgBox: 'h-14 w-14',
      emoji: 'text-3xl',
      text: 'text-base font-bold',
      border: 'border-[4px]',
    },
    md: {
      padding: 'p-4 gap-2',
      imgBox: 'h-24 w-24 md:h-28 md:w-28',
      emoji: 'text-5xl md:text-6xl',
      text: 'text-xl md:text-2xl font-bold',
      border: 'border-[5px]',
    },
    lg: {
      padding: 'p-5 gap-3',
      imgBox: 'h-32 w-32 md:h-40 md:w-40',
      emoji: 'text-6xl md:text-7xl',
      text: 'text-2xl md:text-3xl font-extrabold',
      border: 'border-[5px]',
    },
    xl: {
      padding: 'p-6 gap-4',
      imgBox: 'h-40 w-40 md:h-48 md:w-48',
      emoji: 'text-7xl md:text-8xl',
      text: 'text-3xl md:text-4xl font-extrabold',
      border: 'border-[6px]',
    },
  }[size];

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'bg-white rounded-3xl shadow-sm flex flex-col items-center justify-center text-center transition-all duration-150 active:scale-[0.97]',
        sizeConfig.border,
        sizeConfig.padding,
        BORDER_STYLES[color],
        highlighted ? `${HIGHLIGHT_STYLES[color]} caa-speaking-highlight shadow-md` : '',
        dimmed ? 'opacity-50' : 'opacity-100',
        className,
      ].join(' ')}
    >
      <div className={`flex items-center justify-center overflow-hidden ${sizeConfig.imgBox}`}>
        <MediaImage
          mediaId={imageMediaId}
          emojiFallback={emojiFallback}
          alt={label}
          emojiClassName={sizeConfig.emoji}
        />
      </div>
      <div className="leading-tight text-slate-800 px-1">
        <span className={sizeConfig.text}>{label}</span>
        {sublabel && (
          <p className="text-sm md:text-base font-medium text-slate-500 mt-0.5">{sublabel}</p>
        )}
      </div>
    </button>
  );
}
