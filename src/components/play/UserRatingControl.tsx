'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';

interface UserRatingControlProps {
  rating?: number | null;
  onChange: (rating: number | null) => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
}

/** 1–10 Trakt-scale personal rating picker. */
export default function UserRatingControl({
  rating,
  onChange,
  disabled,
  compact,
}: UserRatingControlProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const display = hover ?? rating ?? 0;

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
      className={`inline-flex items-center gap-1 ${compact ? '' : 'rounded-full border border-gray-300 bg-white/85 px-2.5 py-1 dark:border-gray-600 dark:bg-gray-800/85'}`}
      onMouseLeave={() => setHover(null)}
      title='我的评分（1–10，同步到 Trakt）'
    >
      {!compact && (
        <span className='mr-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 sm:text-xs'>
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
            onClick={() => set(rating === n ? null : n)}
            className='p-0.5 disabled:opacity-50'
            aria-label={`评分 ${n}`}
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
      {rating != null && (
        <span className='ml-0.5 text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400'>
          {rating}
        </span>
      )}
    </div>
  );
}
