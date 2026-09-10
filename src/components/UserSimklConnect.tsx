'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2, Unlink } from 'lucide-react';

export function UserSimklConnect() {
  const [loading, setLoading] = useState(true);
  const [appConfigured, setAppConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [simklUsername, setSimklUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/simkl/status', { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      setAppConfigured(Boolean(json.appConfigured));
      setConnected(Boolean(json.connected));
      setSimklUsername(json.simklUsername || null);
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
      await fetch('/api/simkl/status', {
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

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap items-center gap-2'>
        {connected ? (
          <>
            <span className='text-xs text-emerald-600 dark:text-emerald-400'>
              已连接{simklUsername ? `：${simklUsername}` : ''}
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
            href={appConfigured ? '/api/simkl/auth' : undefined}
            aria-disabled={!appConfigured}
            onClick={(e) => {
              if (!appConfigured) e.preventDefault();
            }}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              appConfigured
                ? 'border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800'
                : 'cursor-not-allowed border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500'
            }`}
          >
            <Link2 className='h-3.5 w-3.5' />
            连接 Simkl
          </a>
        )}
      </div>
      {!appConfigured && (
        <p className='text-xs text-gray-500 dark:text-gray-400'>
          管理员尚未配置 Simkl（not configured by
          admin）。本地已看记录仍可正常使用。
        </p>
      )}
    </div>
  );
}
