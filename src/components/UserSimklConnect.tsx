'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link2, Unlink, X, ExternalLink, Loader2 } from 'lucide-react';

type PinSession = {
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  startedAt: number;
};

export function UserSimklConnect() {
  const [loading, setLoading] = useState(true);
  const [appConfigured, setAppConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [simklUsername, setSimklUsername] = useState<string | null>(null);
  const [redirectAvailable, setRedirectAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState<PinSession | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinStatus, setPinStatus] = useState<
    'idle' | 'waiting' | 'expired' | 'error'
  >('idle');
  const [tick, setTick] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!pin || pinStatus !== 'waiting') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [pin, pinStatus]);

  const clearPoll = () => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/simkl/status', { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      setAppConfigured(Boolean(json.appConfigured));
      setConnected(Boolean(json.connected));
      setSimklUsername(json.simklUsername || null);
      setRedirectAvailable(Boolean(json.redirectAvailable));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      cancelled.current = true;
      clearPoll();
    };
  }, []);

  const cancelPin = useCallback(() => {
    cancelled.current = true;
    clearPoll();
    setPin(null);
    setPinStatus('idle');
    setPinError(null);
    setBusy(false);
  }, []);

  const schedulePoll = useCallback(
    (session: PinSession) => {
      clearPoll();
      const elapsedSec = (Date.now() - session.startedAt) / 1000;
      if (elapsedSec >= session.expires_in) {
        setPinStatus('expired');
        setBusy(false);
        return;
      }
      pollTimer.current = setTimeout(
        async () => {
          if (cancelled.current) return;
          try {
            const res = await fetch(
              `/api/simkl/pin?code=${encodeURIComponent(session.user_code)}`,
              { credentials: 'include' },
            );
            if (cancelled.current) return;
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              setPinStatus('error');
              setPinError(json.error || '轮询失败');
              setBusy(false);
              return;
            }
            if (json.status === 'authorized') {
              clearPoll();
              setPin(null);
              setPinStatus('idle');
              setBusy(false);
              await refresh();
              return;
            }
            if (json.status === 'expired') {
              setPinStatus('expired');
              setBusy(false);
              return;
            }
            // pending — continue
            schedulePoll(session);
          } catch {
            if (cancelled.current) return;
            setPinStatus('error');
            setPinError('网络错误，请重试');
            setBusy(false);
          }
        },
        Math.max(1, session.interval) * 1000,
      );
    },
    [refresh],
  );

  const startPin = async () => {
    if (!appConfigured || busy) return;
    cancelled.current = false;
    setBusy(true);
    setPinError(null);
    setPinStatus('waiting');
    try {
      const res = await fetch('/api/simkl/pin', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPinStatus('error');
        setPinError(json.error || '无法获取 PIN');
        setBusy(false);
        return;
      }
      const session: PinSession = {
        user_code: json.user_code,
        verification_uri: json.verification_uri || 'https://simkl.com/pin',
        expires_in: Number(json.expires_in) || 900,
        interval: Math.max(1, Number(json.interval) || 5),
        startedAt: Date.now(),
      };
      setPin(session);
      schedulePoll(session);
    } catch {
      setPinStatus('error');
      setPinError('网络错误，请重试');
      setBusy(false);
    }
  };

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

  void tick;
  const remainingSec = pin
    ? Math.max(
        0,
        Math.floor(pin.expires_in - (Date.now() - pin.startedAt) / 1000),
      )
    : 0;

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
          <button
            type='button'
            disabled={!appConfigured || busy}
            onClick={startPin}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              appConfigured
                ? 'border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800'
                : 'cursor-not-allowed border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500'
            }`}
          >
            <Link2 className='h-3.5 w-3.5' />
            连接 Simkl
          </button>
        )}
      </div>

      {!appConfigured && (
        <p className='text-xs text-gray-500 dark:text-gray-400'>
          管理员尚未配置 Simkl Client ID（not configured by
          admin）。本地已看记录仍可正常使用。
        </p>
      )}

      {pin && (
        <div className='relative rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/60'>
          <button
            type='button'
            onClick={cancelPin}
            className='absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200'
            aria-label='取消'
          >
            <X className='h-3.5 w-3.5' />
          </button>
          <p className='mb-2 text-xs font-medium text-gray-800 dark:text-gray-100'>
            用手机打开{' '}
            <a
              href={pin.verification_uri}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-0.5 text-blue-600 hover:underline dark:text-blue-400'
            >
              simkl.com/pin
              <ExternalLink className='h-3 w-3' />
            </a>{' '}
            并输入下方代码
          </p>
          <div className='mb-2 flex items-center justify-center rounded-lg bg-white px-3 py-3 font-mono text-2xl tracking-[0.35em] text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-50'>
            {pin.user_code}
          </div>
          {pinStatus === 'waiting' && (
            <p className='flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400'>
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
              等待授权中… 约 {Math.ceil(remainingSec / 60)} 分钟内有效（每{' '}
              {pin.interval}s 检测）
            </p>
          )}
          {pinStatus === 'expired' && (
            <div className='space-y-2 text-center'>
              <p className='text-xs text-amber-600 dark:text-amber-400'>
                代码已过期，请重新获取
              </p>
              <button
                type='button'
                onClick={startPin}
                className='rounded-lg border border-gray-300 px-2.5 py-1 text-xs dark:border-gray-600'
              >
                重新获取 PIN
              </button>
            </div>
          )}
          {pinStatus === 'error' && (
            <div className='space-y-2 text-center'>
              <p className='text-xs text-red-600 dark:text-red-400'>
                {pinError || '出错了'}
              </p>
              <button
                type='button'
                onClick={startPin}
                className='rounded-lg border border-gray-300 px-2.5 py-1 text-xs dark:border-gray-600'
              >
                重试
              </button>
            </div>
          )}
          <button
            type='button'
            onClick={cancelPin}
            className='mt-2 w-full text-center text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          >
            取消
          </button>
        </div>
      )}

      {!connected && !pin && pinStatus === 'error' && pinError && (
        <p className='text-xs text-red-600 dark:text-red-400'>{pinError}</p>
      )}

      {!connected && redirectAvailable && (
        <p className='text-xs text-gray-500 dark:text-gray-400'>
          公网站点也可{' '}
          <a
            href='/api/simkl/auth'
            className='text-blue-600 hover:underline dark:text-blue-400'
          >
            使用浏览器跳转登录
          </a>
          （需配置 Client Secret）。
        </p>
      )}
    </div>
  );
}
