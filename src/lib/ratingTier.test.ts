import { getTier, scoreToPercent, ratingTierFromPercent } from './ratingTier';

describe('ratingTier helpers', () => {
  it('normalizes /10 and % scales', () => {
    expect(scoreToPercent(8.6, '/10')).toBeCloseTo(86);
    expect(scoreToPercent(95, '%')).toBe(95);
    expect(scoreToPercent(53, '%')).toBe(53);
    expect(scoreToPercent(87, '%')).toBe(87);
    expect(scoreToPercent(6.3, '/10')).toBeCloseTo(63);
    // Already 0–100 while labeled /10 (e.g. scaled TMDB shown as 87%)
    expect(scoreToPercent(87, '/10')).toBe(87);
  });

  it('getTier matches agreed thresholds', () => {
    expect(getTier(8.6, '/10')).toBe('great'); // 86%
    expect(getTier(95, '%')).toBe('great');
    expect(getTier(53, '%')).toBe('meh');
    expect(getTier(87, '%')).toBe('great');
    expect(getTier(6.3, '/10')).toBe('meh'); // 63%
    expect(getTier(7.0, '/10')).toBe('good'); // 70%
    expect(getTier(8.4, '/10')).toBe('good'); // 84%
    expect(getTier(8.5, '/10')).toBe('great'); // 85%
    expect(getTier(49.99, '%')).toBe('bad');
    expect(getTier(50, '%')).toBe('meh');
    expect(getTier(69.99, '%')).toBe('meh');
    expect(getTier(76, '%')).toBe('good');
  });

  it('ratingTierFromPercent boundaries', () => {
    expect(ratingTierFromPercent(85)).toBe('great');
    expect(ratingTierFromPercent(84.99)).toBe('good');
    expect(ratingTierFromPercent(70)).toBe('good');
    expect(ratingTierFromPercent(69.99)).toBe('meh');
    expect(ratingTierFromPercent(50)).toBe('meh');
    expect(ratingTierFromPercent(49.99)).toBe('bad');
  });
});
