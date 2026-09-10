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

export interface StoredDanmuSettings {
  enabled: boolean;
  fontSize: number;
  speed: number;
  opacity: number;
  margin: [number | string, number | string];
  modes: Array<0 | 1 | 2>;
  antiOverlap: boolean;
  visible: boolean;
  /** 1 (sparse) … 6 (dense). Caps how many comments can be on screen at once. */
  density: number;
}

export const DANMU_AREA_STEPS: {
  label: string;
  margin: [number | string, number | string];
}[] = [
  { label: '1/6', margin: [10, '83%'] },
  { label: '2/6', margin: [10, '67%'] },
  { label: '3/6', margin: [10, '50%'] },
  { label: '4/6', margin: [10, '33%'] },
  { label: '5/6', margin: [10, '17%'] },
  { label: '6/6', margin: [10, 10] },
];

export const DANMU_MARGIN_OPTION = {
  min: 0,
  max: 5,
  steps: DANMU_AREA_STEPS.map((step) => ({
    name: step.label,
    value: step.margin,
  })),
};

const DENSITY_MAX_VISIBLE = [8, 14, 22, 32, 44, 60] as const;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function clampDanmuDensity(level: number): number {
  return clampInt(level, 1, 6);
}

export function maxVisibleForDensity(level: number): number {
  return DENSITY_MAX_VISIBLE[clampDanmuDensity(level) - 1];
}

function marginBottomPercent(
  margin: [number | string, number | string],
): number {
  const bottom = margin[1];
  if (typeof bottom === 'number') return 0;
  const parsed = parseFloat(String(bottom));
  return Number.isFinite(parsed) ? parsed : 50;
}

export function areaIndexFromMargin(
  margin: [number | string, number | string],
): number {
  const bottom = marginBottomPercent(margin);
  let best = 0;
  let bestDelta = Infinity;
  DANMU_AREA_STEPS.forEach((step, index) => {
    const stepBottom = marginBottomPercent(step.margin);
    const delta = Math.abs(stepBottom - bottom);
    if (delta < bestDelta || (delta === bestDelta && index > best)) {
      best = index;
      bestDelta = delta;
    }
  });
  return best;
}

export function marginFromAreaIndex(
  index: number,
): [number | string, number | string] {
  const step =
    DANMU_AREA_STEPS[clampInt(index, 0, DANMU_AREA_STEPS.length - 1)];
  return step.margin;
}

export const DEFAULT_DANMU_SETTINGS: StoredDanmuSettings = {
  enabled: true,
  fontSize: 25,
  speed: 5,
  opacity: 0.8,
  margin: DANMU_AREA_STEPS[1].margin,
  modes: [0, 1, 2],
  antiOverlap: true,
  visible: true,
  density: 3,
};

const STORAGE = {
  enabled: 'enable_external_danmu',
  fontSize: 'danmaku_fontSize',
  speed: 'danmaku_speed',
  opacity: 'danmaku_opacity',
  margin: 'danmaku_margin',
  modes: 'danmaku_modes',
  antiOverlap: 'danmaku_antiOverlap',
  visible: 'danmaku_visible',
  density: 'danmaku_density',
} as const;

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readStoredDanmuSettings(): StoredDanmuSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_DANMU_SETTINGS };
  const margin = marginFromAreaIndex(
    areaIndexFromMargin(
      parseJson(
        localStorage.getItem(STORAGE.margin),
        DEFAULT_DANMU_SETTINGS.margin,
      ),
    ),
  );
  const modes = parseJson(
    localStorage.getItem(STORAGE.modes),
    DEFAULT_DANMU_SETTINGS.modes,
  );
  return {
    enabled: localStorage.getItem(STORAGE.enabled) !== 'false',
    fontSize: Number(
      localStorage.getItem(STORAGE.fontSize) || DEFAULT_DANMU_SETTINGS.fontSize,
    ),
    speed: Number(
      localStorage.getItem(STORAGE.speed) || DEFAULT_DANMU_SETTINGS.speed,
    ),
    opacity: Number(
      localStorage.getItem(STORAGE.opacity) || DEFAULT_DANMU_SETTINGS.opacity,
    ),
    margin,
    modes,
    antiOverlap: localStorage.getItem(STORAGE.antiOverlap) !== 'false',
    visible: localStorage.getItem(STORAGE.visible) !== 'false',
    density: clampDanmuDensity(
      Number(
        localStorage.getItem(STORAGE.density) || DEFAULT_DANMU_SETTINGS.density,
      ),
    ),
  };
}

export function writeStoredDanmuSettings(settings: StoredDanmuSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE.enabled, String(settings.enabled));
  localStorage.setItem(STORAGE.fontSize, String(settings.fontSize));
  localStorage.setItem(STORAGE.speed, String(settings.speed));
  localStorage.setItem(STORAGE.opacity, String(settings.opacity));
  localStorage.setItem(STORAGE.margin, JSON.stringify(settings.margin));
  localStorage.setItem(STORAGE.modes, JSON.stringify(settings.modes));
  localStorage.setItem(STORAGE.antiOverlap, String(settings.antiOverlap));
  localStorage.setItem(STORAGE.visible, String(settings.visible));
  localStorage.setItem(
    STORAGE.density,
    String(clampDanmuDensity(settings.density)),
  );
}

export function settingsFromPluginOption(
  option: Record<string, unknown> | null | undefined,
): Partial<StoredDanmuSettings> {
  if (!option) return {};
  const patch: Partial<StoredDanmuSettings> = {};
  if (typeof option.fontSize === 'number') patch.fontSize = option.fontSize;
  if (typeof option.speed === 'number') patch.speed = option.speed;
  if (typeof option.opacity === 'number') patch.opacity = option.opacity;
  if (Array.isArray(option.margin) && option.margin.length >= 2) {
    patch.margin = option.margin as StoredDanmuSettings['margin'];
  }
  if (Array.isArray(option.modes)) {
    patch.modes = option.modes.filter(
      (mode): mode is 0 | 1 | 2 => mode === 0 || mode === 1 || mode === 2,
    );
  }
  if (typeof option.antiOverlap === 'boolean') {
    patch.antiOverlap = option.antiOverlap;
  }
  if (typeof option.visible === 'boolean') patch.visible = option.visible;
  return patch;
}

export function countEmittingDanmu(
  overlay: Element | null | undefined,
): number {
  if (!overlay) return 0;
  return overlay.querySelectorAll('[data-state="emit"]').length;
}

export function pluginConfigFromSettings(
  settings: StoredDanmuSettings,
): Record<string, unknown> {
  return {
    fontSize: settings.fontSize,
    speed: settings.speed,
    opacity: settings.opacity,
    margin: settings.margin,
    modes: settings.modes,
    antiOverlap: settings.antiOverlap,
    visible: settings.enabled && settings.visible,
  };
}

type DanmukuPlugin = {
  reset?: () => unknown;
  load: (danmuku?: unknown) => Promise<unknown> | unknown;
  show?: () => unknown;
  hide?: () => unknown;
  config?: (option: Record<string, unknown>) => unknown;
  isStop?: boolean;
};

/**
 * Native toggle icon is `[data-danmuku-visible]` on the player. plugin.show()
 * / hide() change opacity but do not update that attribute, so the button can
 * look ON while comments are hidden.
 */
export function applyDanmuVisibility(
  plugin: DanmukuPlugin | null | undefined,
  visible: boolean,
  playerEl?: HTMLElement | null,
): void {
  if (!plugin) return;
  if (visible) plugin.show?.();
  else plugin.hide?.();
  if (playerEl) {
    playerEl.dataset.danmukuVisible = visible ? 'true' : 'false';
  }
}

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
