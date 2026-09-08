import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import {
  buildResolutionFilterFromSearchParams,
  filterSearchResultsByResolution,
} from '@/lib/video-quality';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';

// OrionTV 兼容接口
export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const resourceId = searchParams.get('resourceId');
  const resolutionFilter = buildResolutionFilterFromSearchParams(searchParams);

  if (!query || !resourceId) {
    return NextResponse.json(
      { result: null, error: '缺少必要参数: q 或 resourceId' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const config = await getConfig();
  const apiSites = await getAvailableApiSites(authInfo.username);

  try {
    // 根据 resourceId 查找对应的 API 站点
    const targetSite = apiSites.find((site) => site.key === resourceId);
    if (!targetSite) {
      return NextResponse.json(
        {
          error: `未找到指定的视频源: ${resourceId}`,
          result: null,
        },
        { status: 404 },
      );
    }

    const results = await searchFromApi(targetSite, query);
    let result = results.filter((r) => r.title === query);
    if (!config.SiteConfig.DisableYellowFilter) {
      result = result.filter((result) => {
        const typeName = result.type_name || '';
        return !yellowWords.some((word: string) => typeName.includes(word));
      });
    }

    // 分辨率过滤（resolution 已在 downstream 解析阶段装饰）
    result = filterSearchResultsByResolution(result, resolutionFilter);
    if (result.length === 0) {
      return NextResponse.json(
        {
          error: '未找到结果',
          result: null,
        },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    } else {
      return NextResponse.json(
        { results: result },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: '搜索失败',
        result: null,
      },
      { status: 500 },
    );
  }
}
