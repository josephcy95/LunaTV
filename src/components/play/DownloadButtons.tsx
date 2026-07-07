/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { memo } from 'react';
import { Download } from 'lucide-react';

interface DownloadButtonsProps {
  downloadEnabled: boolean;
  onDownloadClick: () => void;
  onDownloadPanelClick: () => void;
}

/**
 * 下载按钮组件 - 独立拆分以优化性能
 * 包含下载视频按钮和下载管理按钮
 */
const DownloadButtons = memo(function DownloadButtons({
  downloadEnabled,
  onDownloadClick,
  onDownloadPanelClick,
}: DownloadButtonsProps) {
  if (!downloadEnabled) {
    return null;
  }

  return (
    <>
      {/* 下载按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDownloadClick();
        }}
        className='inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-gray-300 bg-white/85 px-4 text-sm font-medium text-gray-800 transition-colors hover:border-green-400 hover:bg-green-50 hover:text-green-700 dark:border-gray-600 dark:bg-gray-800/85 dark:text-gray-100 dark:hover:border-green-500/60 dark:hover:bg-green-500/15 dark:hover:text-green-300'
        title='下载视频'
      >
        <Download className='w-4 h-4' />
        下载
      </button>

      {/* 下载管理按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDownloadPanelClick();
        }}
        className='inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-gray-300 bg-white/85 px-4 text-sm font-medium text-gray-800 transition-colors hover:border-green-400 hover:bg-green-50 hover:text-green-700 dark:border-gray-600 dark:bg-gray-800/85 dark:text-gray-100 dark:hover:border-green-500/60 dark:hover:bg-green-500/15 dark:hover:text-green-300'
        title='下载管理'
      >
        下载管理
      </button>
    </>
  );
});

export default DownloadButtons;
