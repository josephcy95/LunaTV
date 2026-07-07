function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200/80 dark:bg-gray-700/70 ${className}`}
    />
  );
}

export default function SourceBrowserLoading() {
  return (
    <div className='max-w-7xl mx-auto space-y-6 -mt-6 md:mt-0 pb-40 md:pb-safe-bottom'>
      <div className='flex items-center gap-3'>
        <SkeletonBlock className='h-6 w-6 rounded-full' />
        <SkeletonBlock className='h-8 w-32' />
        <SkeletonBlock className='h-5 w-20 rounded-full' />
      </div>

      <section className='rounded-xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800'>
        <div className='flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700'>
          <SkeletonBlock className='h-5 w-32' />
          <SkeletonBlock className='h-6 w-14 rounded-full' />
        </div>
        <div className='flex flex-wrap gap-2 p-5'>
          {Array.from({ length: 12 }).map((_, index) => (
            <SkeletonBlock key={index} className='h-9 w-24' />
          ))}
        </div>
      </section>

      <section className='rounded-xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800'>
        <div className='space-y-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700'>
          <SkeletonBlock className='h-10 w-full' />
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
            <SkeletonBlock className='h-9' />
            <SkeletonBlock className='h-9' />
            <SkeletonBlock className='h-9 col-span-2 sm:col-span-1' />
          </div>
        </div>
      </section>

      <section className='rounded-xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800'>
        <div className='flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700'>
          <SkeletonBlock className='h-5 w-40' />
          <SkeletonBlock className='h-6 w-20 rounded-full' />
        </div>
        <div className='space-y-5 p-5'>
          <div className='flex flex-wrap gap-2.5'>
            {Array.from({ length: 14 }).map((_, index) => (
              <SkeletonBlock key={index} className='h-8 w-16' />
            ))}
          </div>
          <div className='grid grid-cols-3 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className='overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
              >
                <SkeletonBlock className='aspect-[2/3] rounded-none' />
                <div className='space-y-2 p-2 sm:p-3'>
                  <SkeletonBlock className='h-4 w-full' />
                  <SkeletonBlock className='h-3 w-2/3' />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
