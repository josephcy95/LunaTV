export default function SearchLoading() {
  return (
    <section
      aria-busy='true'
      aria-label='正在加载搜索'
      className='mx-auto max-w-7xl px-4 py-8'
    >
      <p
        role='status'
        className='mb-6 text-sm text-gray-600 dark:text-gray-400'
      >
        正在加载搜索…
      </p>
      <div aria-hidden='true' className='space-y-6 motion-safe:animate-pulse'>
        <div className='h-12 rounded-xl bg-gray-200 dark:bg-gray-800' />
        <div className='grid grid-cols-3 gap-4 md:grid-cols-6'>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className='aspect-[2/3] rounded-xl bg-gray-200 dark:bg-gray-800'
            />
          ))}
        </div>
      </div>
    </section>
  );
}
