export default function SkeletonCard() {
  return (
    <div className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'>
      {/* 海报骨架 */}
      <div className='relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-gray-200/70 bg-gray-100 dark:border-white/5 dark:bg-gray-800'>
        {/* 月光扫过 */}
        <div
          className='absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-green-200/25 to-transparent dark:via-green-400/10'
          style={{
            animationDuration: '1.6s',
            animationIterationCount: 'infinite',
          }}
        />
      </div>

      {/* 标题骨架 */}
      <div className='mt-2.5 space-y-2'>
        <div className='relative mx-auto h-3.5 w-4/5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800'>
          <div
            className='absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-green-200/25 to-transparent dark:via-green-400/10'
            style={{
              animationDuration: '1.6s',
              animationIterationCount: 'infinite',
              animationDelay: '0.12s',
            }}
          />
        </div>
        <div className='relative mx-auto h-3 w-1/2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800'>
          <div
            className='absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-green-200/25 to-transparent dark:via-green-400/10'
            style={{
              animationDuration: '1.6s',
              animationIterationCount: 'infinite',
              animationDelay: '0.24s',
            }}
          />
        </div>
      </div>
    </div>
  );
}
