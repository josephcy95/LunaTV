/**
 * Categories that are hidden from the default TVBox configuration.
 *
 * This is intentionally a built-in list for now. `filter=off` remains the
 * explicit opt-out for clients that want the unfiltered category list.
 */
export const tvboxBlockedCategories = [
  '伦理片',
  '伦理',
  '港台三级',
  '韩国伦理',
  '西方伦理',
  '日本伦理',
  '里番动漫',
  '两性课堂',
  '写真热舞',
  '福利',
  '福利视频',
  '福利片',
  '擦边短剧',
  '无码',
  '有码',
] as const;

export function isBlockedTvboxCategory(category: string): boolean {
  const normalizedCategory = category.trim().toLowerCase();

  return tvboxBlockedCategories.some((blockedCategory) =>
    normalizedCategory.includes(blockedCategory.toLowerCase()),
  );
}
