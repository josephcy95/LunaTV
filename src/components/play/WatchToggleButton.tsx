'use client';

import { Check, Eye } from 'lucide-react';

interface WatchToggleButtonProps {
  watched: boolean;
  showStatus?: string;
  onToggle: () => void;
  disabled?: boolean;
}

export default function WatchToggleButton({
  watched,
  showStatus,
  onToggle,
  disabled,
}: WatchToggleButtonProps) {
  const label = watched
    ? showStatus === 'watching'
      ? '本集已看'
      : '已看过'
    : showStatus === 'watching'
      ? '标记本集'
      : '标记已看';

  return (
    <button
      type='button'
      onClick={onToggle}
      disabled={disabled}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors sm:h-10 sm:gap-2 sm:px-4 sm:text-sm ${
        watched
          ? 'border-emerald-400/50 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'border-gray-300 bg-white/85 text-gray-800 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:border-gray-600 dark:bg-gray-800/85 dark:text-gray-100 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300'
      } disabled:opacity-50`}
      aria-label={watched ? '取消已看' : '标记已看'}
      title={
        watched ? '点击取消已看' : '标记为已看（也可在约 80% 进度时自动标记）'
      }
    >
      {watched ? (
        <Check className='size-3.5 sm:size-4' />
      ) : (
        <Eye className='size-3.5 sm:size-4' />
      )}
      {label}
    </button>
  );
}
