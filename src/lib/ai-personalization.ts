/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import type { VideoContext } from '@/lib/ai-orchestrator';
import { db } from '@/lib/db';
import type { Favorite, PlayRecord, Reminder, UserPlayStat } from '@/lib/types';

type ContentKind = 'movie' | 'tv' | 'anime' | 'variety' | 'mixed';

interface PersonalizationOptions {
  username: string;
  userMessage: string;
  context?: VideoContext;
  enabled?: boolean;
  mode?: 'minimal' | 'balanced' | 'max';
  preferAvailable?: boolean;
  cacheTtlSeconds?: number;
}

interface ContentItem {
  title: string;
  year?: string;
  type: ContentKind;
  source?: string;
  saveTime?: number;
  totalEpisodes?: number;
  currentEpisode?: number;
  completionRate?: number;
  remarks?: string;
  doubanId?: number;
}

interface TasteSummary {
  preferredTypes: Array<{ type: ContentKind; count: number }>;
  preferredSources: Array<{ source: string; count: number }>;
  completionSignals: {
    finishedCount: number;
    droppedCount: number;
    highEngagementCount: number;
  };
  recentSearches: string[];
}

const KIND_LABELS: Record<ContentKind, string> = {
  movie: '电影',
  tv: '电视剧/剧集',
  anime: '动漫/动画',
  variety: '综艺',
  mixed: '混合',
};

function inferRequestedKind(message: string, context?: VideoContext): ContentKind {
  const normalized = message.toLowerCase();

  if (/(动漫|动画|番剧|新番|anime|animation)/i.test(message)) return 'anime';
  if (/(电视剧|剧集|剧|series|tv show|tv)/i.test(message)) return 'tv';
  if (/(综艺|variety|真人秀)/i.test(message)) return 'variety';
  if (/(电影|影片|movie|film)/i.test(message)) return 'movie';

  if (context?.type === 'movie') return 'movie';
  if (context?.type === 'tv') return 'tv';
  if (normalized.includes('recommend') || message.includes('推荐')) return 'mixed';

  return 'mixed';
}

function inferItemType(type?: string, title?: string, remarks?: string): ContentKind {
  const joined = `${type || ''} ${title || ''} ${remarks || ''}`.toLowerCase();

  if (/(anime|animation|动漫|动画|番剧|新番|国产动漫|日本动漫)/i.test(joined)) {
    return 'anime';
  }
  if (/(variety|综艺|真人秀)/i.test(joined)) return 'variety';
  if (/(movie|film|电影|影片)/i.test(joined)) return 'movie';
  if (/(tv|series|show|剧集|电视剧|连续剧)/i.test(joined)) return 'tv';

  return 'mixed';
}

function completionRate(playTime?: number, totalTime?: number): number | undefined {
  if (!playTime || !totalTime || totalTime <= 0) return undefined;
  return Math.max(0, Math.min(1, playTime / totalTime));
}

function countTop<T extends string>(
  values: T[],
  limit: number
): Array<{ value: T; count: number }> {
  const counts = new Map<T, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function uniqByTitle(items: ContentItem[]): ContentItem[] {
  const seen = new Set<string>();
  const result: ContentItem[] = [];

  for (const item of items) {
    const key = `${item.title.trim().toLowerCase()}|${item.year || ''}`;
    if (!item.title || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function formatItem(item: ContentItem): string {
  const parts = [`《${item.title}》`];
  if (item.year) parts.push(`(${item.year})`);
  parts.push(`[${KIND_LABELS[item.type]}]`);
  if (item.currentEpisode && item.totalEpisodes) {
    parts.push(`看到 ${item.currentEpisode}/${item.totalEpisodes}`);
  } else if (item.totalEpisodes && item.totalEpisodes > 1) {
    parts.push(`共 ${item.totalEpisodes} 集`);
  }
  if (item.completionRate !== undefined) {
    parts.push(`完成度 ${Math.round(item.completionRate * 100)}%`);
  }
  if (item.source) parts.push(`来源 ${item.source}`);
  if (item.remarks) parts.push(`备注 ${item.remarks}`);

  return `- ${parts.join(' · ')}`;
}

function toWatchItem(record: PlayRecord): ContentItem {
  const rate = completionRate(record.play_time, record.total_time);
  return {
    title: record.title || record.search_title,
    year: record.year,
    type: inferItemType(record.type, record.title, record.remarks),
    source: record.source_name,
    saveTime: record.save_time,
    totalEpisodes: record.total_episodes,
    currentEpisode: record.index,
    completionRate: rate,
    remarks: record.remarks,
    doubanId: record.douban_id,
  };
}

function toFavoriteItem(favorite: Favorite): ContentItem {
  return {
    title: favorite.title || favorite.search_title,
    year: favorite.year,
    type: inferItemType(favorite.type, favorite.title, favorite.remarks),
    source: favorite.source_name,
    saveTime: favorite.save_time,
    totalEpisodes: favorite.total_episodes,
    remarks: favorite.remarks,
  };
}

function toReminderItem(reminder: Reminder): ContentItem {
  return {
    title: reminder.title || reminder.search_title,
    year: reminder.year,
    type: inferItemType(reminder.type, reminder.title, reminder.remarks),
    source: reminder.source_name,
    saveTime: reminder.save_time,
    totalEpisodes: reminder.total_episodes,
    remarks: reminder.releaseDate ? `${reminder.releaseDate} 上映/更新` : reminder.remarks,
  };
}

function filterByKind(items: ContentItem[], kind: ContentKind): ContentItem[] {
  if (kind === 'mixed') return items;
  return items.filter((item) => item.type === kind || item.type === 'mixed');
}

function buildTasteSummary(
  watchItems: ContentItem[],
  favoriteItems: ContentItem[],
  searches: string[]
): TasteSummary {
  const allItems = [...watchItems, ...favoriteItems];
  const preferredTypes = countTop(
    allItems.map((item) => item.type),
    5
  ).map(({ value, count }) => ({ type: value, count }));
  const preferredSources = countTop(
    allItems.map((item) => item.source || ''),
    5
  ).map(({ value, count }) => ({ source: value, count }));

  return {
    preferredTypes,
    preferredSources,
    completionSignals: {
      finishedCount: watchItems.filter((item) => (item.completionRate || 0) >= 0.85).length,
      droppedCount: watchItems.filter((item) => {
        const rate = item.completionRate;
        return rate !== undefined && rate > 0.02 && rate < 0.2;
      }).length,
      highEngagementCount: watchItems.filter((item) => {
        const rate = item.completionRate;
        return rate !== undefined && rate >= 0.6;
      }).length,
    },
    recentSearches: searches.slice(0, 16),
  };
}

async function enrichDoubanAnchors(items: ContentItem[]): Promise<string[]> {
  const anchors = uniqByTitle(items)
    .filter((item) => item.doubanId && item.doubanId > 0)
    .slice(0, 4);

  if (anchors.length === 0) return [];

  const { scrapeDoubanDetails } = await import('@/app/api/douban/details/route');
  const results = await Promise.allSettled(
    anchors.map(async (item) => {
      const result = await scrapeDoubanDetails(String(item.doubanId));
      if (result.code !== 200 || !result.data) return null;

      const data = result.data as any;
      const details = [
        `《${data.title || item.title}》`,
        data.year ? `(${data.year})` : '',
        data.rate ? `豆瓣 ${data.rate}` : '',
        Array.isArray(data.genres) && data.genres.length > 0
          ? `类型 ${data.genres.slice(0, 4).join('、')}`
          : '',
        Array.isArray(data.directors) && data.directors.length > 0
          ? `导演 ${data.directors.slice(0, 2).join('、')}`
          : '',
      ].filter(Boolean);

      return `- ${details.join(' · ')}`;
    })
  );

  return results
    .map((result) => (result.status === 'fulfilled' ? result.value : null))
    .filter((line): line is string => Boolean(line));
}

function formatStats(stat: UserPlayStat | null): string {
  if (!stat) return '- 暂无累计统计';

  const parts = [
    `总观看 ${Math.round((stat.totalWatchTime || 0) / 3600)} 小时`,
    `播放 ${stat.totalPlays || 0} 次`,
    `去重作品 ${stat.totalMovies || 0} 部`,
    stat.mostWatchedSource ? `常用来源 ${stat.mostWatchedSource}` : '',
  ].filter(Boolean);

  return `- ${parts.join(' · ')}`;
}

export async function buildUserPersonalizationPrompt(
  options: PersonalizationOptions
): Promise<string> {
  if (options.enabled === false) return '';

  const mode = options.mode || 'balanced';
  const cacheTtl = options.cacheTtlSeconds ?? 300;
  const requestedKind = inferRequestedKind(options.userMessage, options.context);
  const cacheKey = `ai-personal-context:${options.username}:${requestedKind}:${mode}:v1`;

  const cached = await db.getCache(cacheKey).catch(() => null);
  if (typeof cached === 'string' && cached.trim()) {
    return cached;
  }

  const [recordsResult, favoritesResult, remindersResult, searchesResult, statsResult] =
    await Promise.allSettled([
      db.getAllPlayRecords(options.username),
      db.getAllFavorites(options.username),
      db.getAllReminders(options.username),
      db.getSearchHistory(options.username),
      db.getUserPlayStat(options.username),
    ]);

  const records =
    recordsResult.status === 'fulfilled' ? Object.values(recordsResult.value || {}) : [];
  const favorites =
    favoritesResult.status === 'fulfilled' ? Object.values(favoritesResult.value || {}) : [];
  const reminders =
    remindersResult.status === 'fulfilled' ? Object.values(remindersResult.value || {}) : [];
  const searches = searchesResult.status === 'fulfilled' ? searchesResult.value || [] : [];
  const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;

  if (
    records.length === 0 &&
    favorites.length === 0 &&
    reminders.length === 0 &&
    searches.length === 0
  ) {
    const emptyPrompt = `\n## 当前用户个性化上下文\n- 当前用户还没有足够的观看、收藏或搜索记录。推荐时可以先给通用建议，并提示用户多使用一段时间后会更个性化。\n`;
    await db.setCache(cacheKey, emptyPrompt, cacheTtl).catch(() => undefined);
    return emptyPrompt;
  }

  const limits = {
    minimal: { recent: 8, favorite: 8, reminder: 6, anchor: 8 },
    balanced: { recent: 20, favorite: 16, reminder: 10, anchor: 14 },
    max: { recent: 60, favorite: 50, reminder: 30, anchor: 30 },
  }[mode];

  const watchItems = records
    .map(toWatchItem)
    .filter((item) => Boolean(item.title))
    .sort((a, b) => (b.saveTime || 0) - (a.saveTime || 0));
  const favoriteItems = favorites
    .map(toFavoriteItem)
    .filter((item) => Boolean(item.title))
    .sort((a, b) => (b.saveTime || 0) - (a.saveTime || 0));
  const reminderItems = reminders
    .map(toReminderItem)
    .filter((item) => Boolean(item.title))
    .sort((a, b) => (b.saveTime || 0) - (a.saveTime || 0));

  const tasteSummary = buildTasteSummary(watchItems, favoriteItems, searches);
  const kindWatchItems = filterByKind(watchItems, requestedKind);
  const kindFavoriteItems = filterByKind(favoriteItems, requestedKind);
  const kindReminderItems = filterByKind(reminderItems, requestedKind);
  const anchorItems = uniqByTitle([
    ...kindFavoriteItems,
    ...kindWatchItems.filter((item) => (item.completionRate || 0) >= 0.6),
    ...favoriteItems,
    ...watchItems.filter((item) => (item.completionRate || 0) >= 0.6),
  ]).slice(0, limits.anchor);

  const doubanAnchors = await enrichDoubanAnchors(anchorItems).catch((error) => {
    console.warn('AI personalization douban enrichment failed:', error);
    return [];
  });

  const lines = [
    '',
    '## 当前用户个性化上下文',
    `- 推荐目标类型: ${KIND_LABELS[requestedKind]}`,
    `- 个性化模式: ${mode}`,
    `- 站内可用性策略: ${options.preferAvailable === false ? '不强制验证片源' : '优先推荐用户历史/收藏相关且站内更可能可搜到的内容'}`,
    '',
    '### 用户整体偏好',
    formatStats(stats),
    `- 常看类型: ${tasteSummary.preferredTypes.map((item) => `${KIND_LABELS[item.type]} ${item.count}`).join('、') || '暂无'}`,
    `- 常用来源: ${tasteSummary.preferredSources.map((item) => `${item.source} ${item.count}`).join('、') || '暂无'}`,
    `- 观看信号: 高参与 ${tasteSummary.completionSignals.highEngagementCount}、基本看完 ${tasteSummary.completionSignals.finishedCount}、低完成/可能弃看 ${tasteSummary.completionSignals.droppedCount}`,
  ];

  if (searches.length > 0) {
    lines.push(`- 最近搜索: ${tasteSummary.recentSearches.join('、')}`);
  }

  lines.push('', `### 与“${KIND_LABELS[requestedKind]}”相关的站内偏好锚点`);
  lines.push('- 这些标题来自用户观看/收藏记录，表示 LunaTV 曾经可搜到或用户已收藏。请把它们当作口味依据，不要直接当成新推荐。');
  lines.push(...(anchorItems.length > 0 ? anchorItems.map(formatItem) : ['- 暂无同类型偏好锚点，请用整体偏好辅助推荐']));

  if (doubanAnchors.length > 0) {
    lines.push('', '### 偏好锚点的豆瓣补充资料');
    lines.push(...doubanAnchors);
  }

  lines.push('', '### 最近观看');
  const recentLines = uniqByTitle(kindWatchItems.length > 0 ? kindWatchItems : watchItems)
    .slice(0, limits.recent)
    .map(formatItem);
  lines.push(...(recentLines.length > 0 ? recentLines : ['- 暂无观看记录']));

  lines.push('', '### 收藏/想看');
  const favoriteLines = uniqByTitle(kindFavoriteItems.length > 0 ? kindFavoriteItems : favoriteItems)
    .slice(0, limits.favorite)
    .map(formatItem);
  lines.push(...(favoriteLines.length > 0 ? favoriteLines : ['- 暂无收藏记录']));

  if (reminderItems.length > 0) {
    lines.push('', '### 提醒/待上映');
    lines.push(
      ...(uniqByTitle(kindReminderItems.length > 0 ? kindReminderItems : reminderItems)
        .slice(0, limits.reminder)
        .map(formatItem))
    );
  }

  lines.push(
    '',
    '### 个性化推荐规则',
    '1. 用户要求推荐电影/电视剧/动漫时，必须优先根据上述用户画像和同类型偏好锚点推荐，不要给通用榜单。',
    '2. 收藏、较高完成度观看、最近搜索的权重高于低完成度播放记录。',
    '3. 避免把用户已经看过或收藏过的作品当成“新推荐”；可以把它们作为相似口味依据。',
    '4. 推荐理由要明确对应用户的偏好依据，例如题材、类型、节奏、地区、历史观看相似点。',
    '5. 如果站内可用性不确定，可以推荐但要说“可先搜索片源”；不要承诺一定可播。',
    '6. 不要声称用户喜欢、看过或收藏过任何不在上下文里的作品。'
  );

  const prompt = `${lines.join('\n')}\n`;
  await db.setCache(cacheKey, prompt, cacheTtl).catch(() => undefined);
  return prompt;
}
