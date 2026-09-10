'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';

interface UserRatingControlProps {
  rating?: number | null;
  onChange: (rating: number | null) => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
}

/** 1–10 Trakt-scale personal rating picker (shared by play page + /watched). */
export default function UserRatingControl({
  rating,
  onChange,
  disabled,
  compact,
}: UserRatingControlProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const display = hover ?? rating ?? 0;
  /** Trailing digit: hover preview when active, else selected rating. */
  const numeric = hover ?? rating ?? null;

  const set = async (value: number | null) => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await onChange(value);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        compact
          ? 'inline-flex items-center gap-0.5'
          : // Match WatchToggleButton / 已收藏: h-9 sm:h-10, same padding & text size
            'inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full border border-gray-300 bg-white/85 px-3 text-xs font-medium leading-none sm:h-10 sm:gap-1 sm:px-4 sm:text-sm dark:border-gray-600 dark:bg-gray-800/85'
      }
      onMouseLeave={() => setHover(null)}
      title='我的评分（1–10，同步到 Trakt）'
    >
      {!compact && (
        <span className='mr-1 shrink-0 text-[10px] font-medium leading-none text-gray-500 dark:text-gray-400 sm:mr-1.5 sm:text-xs'>
          我的评分
        </span>
      )}
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const active = n <= display;
        return (
          <button
            key={n}
            type='button'
            disabled={disabled || busy}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => set(rating === n ? null : n)}
            className='inline-flex items-center justify-center p-0 leading-none disabled:opacity-50'
            aria-label={`评分 ${n}`}
            aria-pressed={rating === n}
          >
            <Star
              className={`${compact ? 'size-3.5' : 'size-3.5 sm:size-4'} ${
                active
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300 dark:text-gray-600'
              }`}
            />
          </button>
        );
      })}
      {/* Always reserve digit width so hover/select doesn't shift neighbors */}
      <span
        className={`ml-0.5 inline-flex min-w-[2ch] justify-center tabular-nums font-semibold leading-none ${
          compact ? 'text-[10px]' : 'text-xs sm:text-sm'
        } ${
          numeric != null
            ? hover != null && hover !== rating
              ? 'text-amber-500 dark:text-amber-300'
              : 'text-amber-600 dark:text-amber-400'
            : 'text-transparent'
        }`}
        aria-hidden={numeric == null}
      >
        {numeric ?? 0}
      </span>
    </div>
  );
}
