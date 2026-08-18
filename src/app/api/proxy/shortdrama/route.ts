/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { fetchWithValidatedRedirects } from '@/lib/proxy-security';
import { DEFAULT_USER_AGENT } from '@/lib/user-agent';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const decodedUrl = url;

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
      'Range': request.headers.get('range') || '',
    };

    // 移除空的 Range header
    if (!headers['Range']) {
      delete headers['Range'];
    }

    const response = await fetchWithValidatedRedirects(
      decodedUrl,
      { cache: 'no-cache', headers: new Headers(headers) },
      { timeoutMs: 30000 },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    // 流式传输视频内容
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', response.headers.get('content-type') || 'video/mp4');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range');

    if (response.headers.get('content-length')) {
      responseHeaders.set('Content-Length', response.headers.get('content-length')!);
    }
    if (response.headers.get('content-range')) {
      responseHeaders.set('Content-Range', response.headers.get('content-range')!);
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error('短剧代理错误:', error);

    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }

    return NextResponse.json(
      { error: `Proxy error: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function HEAD(request: Request) {
  // HEAD 请求也需要支持
  return GET(request);
}
