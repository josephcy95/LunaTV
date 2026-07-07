/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

interface NetDiskButtonProps {
  videoTitle: string;
  netdiskLoading: boolean;
  netdiskTotal: number;
  netdiskResults: any;
  onSearch: (title: string) => void;
  onOpenModal: () => void;
}

export default function NetDiskButton({
  videoTitle,
  netdiskLoading,
  netdiskTotal,
  netdiskResults,
  onSearch,
  onOpenModal,
}: NetDiskButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 触发网盘搜索（如果还没搜索过）
    if (!netdiskResults && !netdiskLoading && videoTitle) {
      onSearch(videoTitle);
    }
    // 打开网盘模态框
    onOpenModal();
  };

  return (
    <button
      onClick={handleClick}
      className='inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-gray-300 bg-white/85 px-4 text-sm font-medium text-gray-800 transition-colors hover:border-green-400 hover:bg-green-50 hover:text-green-700 dark:border-gray-600 dark:bg-gray-800/85 dark:text-gray-100 dark:hover:border-green-500/60 dark:hover:bg-green-500/15 dark:hover:text-green-300'
      title='网盘资源'
    >
      {netdiskLoading && (
        <span className='inline-block h-3 w-3 rounded-full border-2 border-gray-300 border-t-green-500 animate-spin'></span>
      )}
      {netdiskLoading ? '搜索中' : netdiskTotal > 0 ? `网盘 (${netdiskTotal})` : '网盘'}
    </button>
  );
}
