/** @jest-environment node */

jest.mock('@/lib/performance-monitor', () => ({ recordRequest: jest.fn() }));

import { recordStreamingMetrics } from '../streaming-metrics';
const { recordRequest } = jest.requireMock('../performance-monitor') as {
  recordRequest: jest.Mock;
};

describe('recordStreamingMetrics', () => {
  beforeEach(() => {
    recordRequest.mockReset();
    jest.spyOn(performance, 'now').mockReturnValue(100);
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });
  afterEach(() => jest.restoreAllMocks());

  it('records privacy-safe lifecycle fields without query text', () => {
    recordStreamingMetrics({
      requestId: 'req-123',
      path: '/api/search',
      startedAt: 1000,
      completedAt: 1250,
      setupMs: 40,
      firstResultMs: 180,
      providerFailures: 1,
      resultCount: 7,
      statusCode: 206,
    });
    expect(recordRequest).toHaveBeenCalledTimes(1);
    const metric = recordRequest.mock.calls[0][0];
    expect(metric).toMatchObject({
      timestamp: 1700000000000,
      method: 'GET',
      path: '/api/search',
      requestId: 'req-123',
      statusCode: 206,
      duration: 250,
      dbQueries: 0,
      phases: {
        setup: 40,
        firstResult: 180,
        completion: 250,
        providerFailures: 1,
        resultCount: 7,
      },
    });
    expect(metric).not.toHaveProperty('query');
  });

  it('uses safe defaults and derives provider failure status', () => {
    recordStreamingMetrics({
      requestId: 'req-failed',
      path: '/api/search',
      startedAt: 500,
      completedAt: 450,
      providerFailures: 2,
    });
    const metric = recordRequest.mock.calls[0][0];
    expect(metric.statusCode).toBe(502);
    expect(metric.duration).toBe(0);
    expect(metric.phases).toEqual({
      completion: 0,
      providerFailures: 2,
      resultCount: 0,
    });
    expect(metric).not.toHaveProperty('query');
  });
});
