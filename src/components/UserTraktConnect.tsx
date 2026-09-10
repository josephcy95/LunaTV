'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2, Unlink } from 'lucide-react';

export function UserTraktConnect() {
  const [loading, setLoading] = useState(true);
  const [appConfigured, setAppConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [traktUsername, setTraktUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trakt/status', { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      setAppConfigured(Boolean(json.appConfigured));
      setConnected(Boolean(json.connected));
      setTraktUsername(json.traktUsername || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch('/api/trakt/status', {
        method: 'DELETE',
        credentials: 'include',
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className='text-xs text-gray-500 dark:text-gray-400'>加载中…</p>;
  }

  if (!appConfigured) {
    return (
      <p className='text-xs text-gray-500 dark:text-gray-400'>
        管理员尚未配置 Trakt Client ID/Secret。本地已看记录仍可正常使用。
      </p>
    );
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {connected ? (
        <>
          <span className='text-xs text-emerald-600 dark:text-emerald-400'>
            已连接{traktUsername ? `：${traktUsername}` : ''}
          </span>
          <button
            type='button'
            disabled={busy}
            onClick={disconnect}
            className='inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
          >
            <Unlink className='h-3.5 w-3.5' />
            断开
          </button>
        </>
      ) : (
        <a
          href='/api/trakt/auth'
          className='inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800'
        >
          <Link2 className='h-3.5 w-3.5' />
          连接 Trakt
        </a>
      )}
    </div>
  );
}
