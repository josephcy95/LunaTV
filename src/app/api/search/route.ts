/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { generateSearchVariants } from '@/lib/downstream';
import { recordRequest, resetDbQueryCount } from '@/lib/performance-monitor';
import {
  buildResolutionFilterFromSearchParams,
  filterSearchResultsByResolution,
} from '@/lib/video-quality';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  const requestId = crypto.randomUUID();
  const phaseStarts: Record<string, number> = { total: startTime };
  const phases: Record<string, number> = {};
  const phase = (name: string) => {
    const now = Date.now();
    if (phaseStarts[name] !== undefined) phases[name] = now - phaseStarts[name];
    phaseStarts[name] = now;
  };
  const recordSearchRequest = (
    metrics: Parameters<typeof recordRequest>[0],
  ) => {
    phases.total = Date.now() - startTime;
    recordRequest({ ...metrics, requestId, phases });
  };
  resetDbQueryCount();
  phase('auth');

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    const errorResponse = { error: 'Unauthorized' };
    const errorSize = Buffer.byteLength(JSON.stringify(errorResponse), 'utf8');

    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/search',
      statusCode: 401,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      requestSize: 0,
      responseSize: errorSize,
    });

    return NextResponse.json(errorResponse, {
      status: 401,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const resolutionFilter = buildResolutionFilterFromSearchParams(searchParams);

  if (!query) {
    phase('serialization');
    const successResponse = { results: [] };
    const responseSize = Buffer.byteLength(
      JSON.stringify(successResponse),
      'utf8',
    );

    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/search',
      statusCode: 200,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      requestSize: 0,
      responseSize,
      filter: 'empty-query',
    });

    return NextResponse.json(successResponse, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  }

  phase('config');
  const config = await getConfig();
  const apiSites = await getAvailableApiSites(authInfo.username);
  phase('provider');

  // 优化：预计算搜索变体，智能生成（普通查询1个，需要变体的2个）
  const searchVariants = generateSearchVariants(query);

  // 添加可取消的超时控制，避免 Promise.race 超时后上游请求继续占用连接。
  const searchPromises = apiSites.map((site) => {
    const deadline = new AbortController();
    const timeoutId = setTimeout(() => deadline.abort(), 20000);
    const signal = AbortSignal.any([request.signal, deadline.signal]);
    return searchFromApi(site, query, searchVariants, { signal })
      .catch((err) => {
        console.warn(
          `搜索失败 ${site.name}:`,
          err instanceof Error ? err.message : err,
        );
        return [];
      })
      .finally(() => clearTimeout(timeoutId));
  });

  try {
    const results = await Promise.allSettled(searchPromises);
    phase('filter');
    const successResults = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value);
    let flattenedResults = successResults.flat();
    if (!config.SiteConfig.DisableYellowFilter) {
      flattenedResults = flattenedResults.filter((result) => {
        const typeName = result.type_name || '';
        return !yellowWords.some((word: string) => typeName.includes(word));
      });
    }

    // 分辨率过滤（resolution 已在 downstream 解析阶段装饰）
    flattenedResults = filterSearchResultsByResolution(
      flattenedResults,
      resolutionFilter,
    );
    if (flattenedResults.length === 0) {
      // no cache if empty
      const emptyResponse = { results: [] };
      const responseSize = Buffer.byteLength(
        JSON.stringify(emptyResponse),
        'utf8',
      );

      recordSearchRequest({
        timestamp: startTime,
        method: 'GET',
        path: '/api/search',
        statusCode: 200,
        duration: Date.now() - startTime,
        memoryUsed:
          (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,

        requestSize: 0,
        responseSize,
        filter: 'search-results',
      });

      return NextResponse.json(emptyResponse, {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    phase('serialization');
    const successResponse = { results: flattenedResults };
    const responseSize = Buffer.byteLength(
      JSON.stringify(successResponse),
      'utf8',
    );

    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/search',
      statusCode: 200,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      requestSize: 0,
      responseSize,
      filter: 'search-results',
    });

    return NextResponse.json(successResponse, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const errorResponse = { error: '搜索失败' };
    const errorSize = Buffer.byteLength(JSON.stringify(errorResponse), 'utf8');

    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/search',
      statusCode: 500,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      requestSize: 0,
      responseSize: errorSize,
    });

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
