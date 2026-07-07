import { NextRequest, NextResponse } from 'next/server';

import { getAdminRoleFromRequest } from '@/lib/admin-auth';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const role = await getAdminRoleFromRequest(request);
    if (!role) {
      return NextResponse.json({ error: '权限不足' }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
    const authInfo = getAuthInfoFromCookie(request);
    let verified = false;

    if (storageType === 'localstorage') {
      verified = password === process.env.PASSWORD;
    } else {
      const username = authInfo?.username;
      if (!username) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (username === process.env.USERNAME) {
        verified = password === process.env.PASSWORD;
      } else {
        const config = await getConfig();
        const user = config.UserConfig.Users.find((u) => u.username === username);
        if (!user || user.banned || user.role !== 'admin') {
          return NextResponse.json({ error: '权限不足' }, { status: 401 });
        }

        verified = await db.verifyUser(username, password);
      }
    }

    if (!verified) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    return NextResponse.json({ ok: true, role });
  } catch (error) {
    return NextResponse.json(
      { error: '验证失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
