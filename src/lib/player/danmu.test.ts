import { loadDanmuIntoPlugin, normalizeDanmuForPlugin } from './danmu';

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
