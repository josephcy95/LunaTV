'use client';

import { CURRENT_VERSION } from '@/lib/version';

export function VersionDisplay() {
  return (
    <div className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400'>
      <span className='font-mono'>v{CURRENT_VERSION}</span>
    </div>
  );
}
