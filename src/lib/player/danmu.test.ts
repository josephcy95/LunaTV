import {
  applyDanmuVisibility,
  areaIndexFromMargin,
  clampDanmuDensity,
  DANMU_AREA_STEPS,
  DEFAULT_DANMU_SETTINGS,
  densityLabel,
  loadDanmuIntoPlugin,
  marginFromAreaIndex,
  maxVisibleForDensity,
  mountNativeDensitySlider,
  normalizeDanmuForPlugin,
  pluginConfigFromSettings,
  readStoredDanmuSettings,
  settingsFromPluginOption,
  writeStoredDanmuSettings,
} from './danmu';

describe('normalizeDanmuForPlugin', () => {
  test('keeps valid timed comments', () => {
    expect(
      normalizeDanmuForPlugin([
        { text: 'hello', time: 94.5, color: '#FF0000', mode: 0 },
      ]),
    ).toEqual([{ text: 'hello', time: 94.5, color: '#FF0000', mode: 0 }]);
  });

  test('does not let time 0 become falsy for the plugin', () => {
    const [item] = normalizeDanmuForPlugin([{ text: 'start', time: 0 }]);
    expect(item.time).toBeGreaterThan(0);
    expect(item.time).toBeLessThan(0.01);
  });

  test('drops empty text and non-objects', () => {
    expect(
      normalizeDanmuForPlugin([
        null,
        'nope',
        { text: '   ', time: 1 },
        { time: 1 },
        { text: 'ok', time: 12 },
      ]),
    ).toEqual([{ text: 'ok', time: 12, color: '#FFFFFF', mode: 0 }]);
  });

  test('clamps invalid mode/color', () => {
    const [item] = normalizeDanmuForPlugin([
      { text: 'x', time: 3, mode: 9, color: '' },
    ]);
    expect(item.mode).toBe(0);
    expect(item.color).toBe('#FFFFFF');
  });
});

describe('loadDanmuIntoPlugin', () => {
  test('clears then loads so comments are not appended twice', async () => {
    const calls: unknown[] = [];
    const plugin = {
      reset: jest.fn(),
      load: jest.fn(async (payload?: unknown) => {
        calls.push(payload);
      }),
    };

    const count = await loadDanmuIntoPlugin(plugin, [
      { text: 'a', time: 1 },
      { text: 'b', time: 2 },
    ]);

    expect(count).toBe(2);
    expect(plugin.reset).toHaveBeenCalledTimes(1);
    expect(calls[0]).toBeUndefined();
    expect(calls[1]).toEqual([
      { text: 'a', time: 1, color: '#FFFFFF', mode: 0 },
      { text: 'b', time: 2, color: '#FFFFFF', mode: 0 },
    ]);
  });

  test('still clears when the list is empty', async () => {
    const plugin = {
      reset: jest.fn(),
      load: jest.fn(async () => undefined),
    };
    await loadDanmuIntoPlugin(plugin, []);
    expect(plugin.reset).toHaveBeenCalled();
    expect(plugin.load).toHaveBeenCalledTimes(1);
  });
});

describe('danmu settings persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('reads defaults when storage is empty', () => {
    expect(readStoredDanmuSettings()).toEqual(DEFAULT_DANMU_SETTINGS);
  });

  test('round-trips settings', () => {
    const settings = {
      ...DEFAULT_DANMU_SETTINGS,
      enabled: false,
      fontSize: 32,
      speed: 8,
      opacity: 0.4,
      visible: false,
      antiOverlap: true,
      density: 2,
    };
    writeStoredDanmuSettings(settings);
    expect(readStoredDanmuSettings()).toEqual(settings);
  });

  test('maps native plugin option changes', () => {
    expect(
      settingsFromPluginOption({
        fontSize: 18,
        speed: 3,
        opacity: 0.5,
        visible: false,
        antiOverlap: true,
        margin: [20, '50%'],
        modes: [0, 2, 9],
      }),
    ).toEqual({
      fontSize: 18,
      speed: 3,
      opacity: 0.5,
      visible: false,
      antiOverlap: true,
      margin: [20, '50%'],
      modes: [0, 2],
    });
  });

  test('hides comments when either enabled or visible is off', () => {
    expect(
      pluginConfigFromSettings({
        ...DEFAULT_DANMU_SETTINGS,
        enabled: true,
        visible: false,
      }).visible,
    ).toBe(false);
    expect(
      pluginConfigFromSettings({
        ...DEFAULT_DANMU_SETTINGS,
        enabled: false,
        visible: true,
      }).visible,
    ).toBe(false);
  });
});

describe('area and density', () => {
  test('exposes six screen-area steps', () => {
    expect(DANMU_AREA_STEPS.map((step) => step.label)).toEqual([
      '1/6',
      '2/6',
      '3/6',
      '4/6',
      '5/6',
      '6/6',
    ]);
  });

  test('snaps old 1/4 margin to the nearest sixth', () => {
    expect(areaIndexFromMargin([10, '75%'])).toBe(1);
    expect(marginFromAreaIndex(0)).toEqual([10, '83%']);
    expect(marginFromAreaIndex(5)).toEqual([10, 10]);
  });

  test('clamps density and maps to a concurrent cap', () => {
    expect(clampDanmuDensity(0)).toBe(1);
    expect(clampDanmuDensity(9)).toBe(6);
    expect(maxVisibleForDensity(1)).toBe(8);
    expect(maxVisibleForDensity(3)).toBe(22);
    expect(maxVisibleForDensity(6)).toBe(60);
    expect(densityLabel(3)).toBe('适中');
  });

  test('injects a density slider into the native config panel', () => {
    const panel = document.createElement('div');
    panel.innerHTML =
      '<div class="apd-config-margin">显示区域</div><div class="apd-config-fontSize">弹幕字号</div>';
    const levels: number[] = [];
    const cleanup = mountNativeDensitySlider(panel, {
      density: 3,
      onChange: (level) => levels.push(level),
    });
    const row = panel.querySelector('.apd-config-density');
    expect(row).toBeTruthy();
    expect(row?.nextElementSibling?.className).toContain('apd-config-fontSize');
    expect(row?.querySelector('.apd-value')?.textContent).toBe('适中');
    cleanup();
    expect(panel.querySelector('.apd-config-density')).toBeNull();
  });
});

describe('applyDanmuVisibility', () => {
  test('updates plugin and native toggle attribute together', () => {
    const plugin = { show: jest.fn(), hide: jest.fn() };
    const player = document.createElement('div');

    applyDanmuVisibility(plugin, false, player);
    expect(plugin.hide).toHaveBeenCalled();
    expect(player.dataset.danmukuVisible).toBe('false');

    applyDanmuVisibility(plugin, true, player);
    expect(plugin.show).toHaveBeenCalled();
    expect(player.dataset.danmukuVisible).toBe('true');
  });
});
