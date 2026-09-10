/**
 * ArtPlayer danmuku helpers.
 *
 * artplayer-plugin-danmuku 5.x treats a falsy `time` (including 0) as "emit
 * immediately at currentTime + 0.5s". That turns a whole episode of comments
 * into a single pile on screen. Normalize before load().
 */

export interface ArtplayerDanmu {
  text: string;
  time: number;
  color?: string;
  mode?: 0 | 1 | 2;
  border?: boolean;
  style?: Partial<CSSStyleDeclaration>;
}

const MIN_PLUGIN_TIME = 0.001;

export function normalizeDanmuForPlugin(items: unknown): ArtplayerDanmu[] {
  if (!Array.isArray(items)) return [];

  const result: ArtplayerDanmu[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const text = String(raw.text ?? '').trim();
    if (!text) continue;

    const timeNum = Number(raw.time);
    const time = Number.isFinite(timeNum)
      ? Math.max(timeNum, MIN_PLUGIN_TIME)
      : MIN_PLUGIN_TIME;

    const modeRaw = Number(raw.mode);
    const mode: 0 | 1 | 2 = modeRaw === 1 || modeRaw === 2 ? modeRaw : 0;

    const color =
      typeof raw.color === 'string' && raw.color.trim() ? raw.color : '#FFFFFF';

    result.push({
      text,
      time,
      color,
      mode,
      ...(typeof raw.border === 'boolean' ? { border: raw.border } : {}),
    });
  }
  return result;
}

type DanmukuPlugin = {
  reset?: () => unknown;
  load: (danmuku?: unknown) => Promise<unknown> | unknown;
  show?: () => unknown;
  hide?: () => unknown;
};

/**
 * Replace the plugin queue with `items`. Always clear first: load(array)
 * appends without resetting, which duplicates comments across episode/source
 * changes.
 */
export async function loadDanmuIntoPlugin(
  plugin: DanmukuPlugin | null | undefined,
  items: unknown,
): Promise<number> {
  if (!plugin) return 0;
  const data = normalizeDanmuForPlugin(items);
  plugin.reset?.();
  await plugin.load();
  if (data.length > 0) {
    await plugin.load(data);
  }
  return data.length;
}
