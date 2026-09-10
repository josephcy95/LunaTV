/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { AlertCircle, User, Lock, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CURRENT_VERSION } from '@/lib/version';

import BrandMark from '@/components/BrandMark';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  OIDCProviderLogo,
  detectProvider,
  getProviderButtonStyle,
  getProviderButtonText,
} from '@/components/OIDCProviderLogos';

function VersionDisplay() {
  return (
    <div className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400'>
      <span className='font-mono'>v{CURRENT_VERSION}</span>
    </div>
  );
}

function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const shouldAskUsername =
    process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'localstorage';

  // OIDC 登录状态
  const [oidcProviders, setOidcProviders] = useState<
    Array<{
      id: string;
      name: string;
      buttonText: string;
      issuer: string;
    }>
  >([]);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcButtonText, setOidcButtonText] = useState('使用OIDC登录');
  const [oidcIssuer, setOidcIssuer] = useState<string>('');

  const { siteName } = useSite();

  // 获取 OIDC 配置
  useEffect(() => {
    const fetchServerConfig = async () => {
      try {
        const response = await fetch('/api/server-config');
        const data = await response.json();
        if (data.OIDCProviders && data.OIDCProviders.length > 0) {
          setOidcProviders(data.OIDCProviders);
          setOidcEnabled(true);
        } else if (data.OIDCConfig?.enabled) {
          setOidcEnabled(true);
          setOidcButtonText(data.OIDCConfig.buttonText || '使用OIDC登录');
          setOidcIssuer(data.OIDCConfig.issuer || '');
        }
      } catch (error) {
        console.log('Failed to fetch server config:', error);
      }
    };

    fetchServerConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!password || (shouldAskUsername && !username)) return;

    try {
      setLoading(true);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          ...(shouldAskUsername ? { username } : {}),
        }),
      });

      if (res.ok) {
        const loginTime = Date.now();
        try {
          await fetch('/api/user/my-stats', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginTime }),
          });
          localStorage.setItem('lastRecordedLogin', loginTime.toString());
        } catch (error) {
          console.log('记录登入时间失败:', error);
        }

        const redirect = searchParams.get('redirect') || '/';
        router.replace(redirect);
      } else if (res.status === 401) {
        setError('密码错误');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '服务器错误');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      translate='no'
      className='fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-3 py-8 sm:px-4 sm:py-10'
    >
      {/* 月夜背景：大月晕 + 远景星点 */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 overflow-hidden'
      >
        <div className='absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-green-400/14 blur-[110px] dark:bg-green-400/10' />
        <div className='absolute bottom-[-12rem] right-[-8rem] h-[26rem] w-[26rem] rounded-full bg-blue-500/10 blur-[100px] dark:bg-indigo-500/12' />
        <span className='animate-moon-pulse absolute left-[16%] top-[22%] h-1 w-1 rounded-full bg-green-400/80 shadow-[0_0_8px_rgba(230,185,74,0.9)]' />
        <span
          className='animate-moon-pulse absolute right-[20%] top-[30%] h-0.5 w-0.5 rounded-full bg-gray-300/90'
          style={{ animationDelay: '0.9s' }}
        />
        <span
          className='animate-moon-pulse absolute left-[30%] bottom-[24%] h-0.5 w-0.5 rounded-full bg-gray-300/70'
          style={{ animationDelay: '1.6s' }}
        />
        <span
          className='animate-moon-pulse absolute right-[32%] bottom-[16%] h-1 w-1 rounded-full bg-green-300/70 shadow-[0_0_6px_rgba(230,185,74,0.7)]'
          style={{ animationDelay: '2.2s' }}
        />
      </div>

      <div className='absolute top-3 right-3 sm:top-4 sm:right-4 z-20'>
        <ThemeToggle />
      </div>

      <div className='glass-panel relative z-10 my-auto w-full max-w-md rounded-3xl p-6 sm:p-8'>
        {/* 标题 */}
        <div className='mb-7 text-center sm:mb-9'>
          <div className='mb-3 flex justify-center'>
            <BrandMark name={siteName} size='lg' />
          </div>
          <p className='eyebrow'>Midnight Cinema · 请登录您的账户</p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {shouldAskUsername && (
            <div>
              <label
                htmlFor='username'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
              >
                用户名
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <User className='h-4 w-4 text-gray-400' />
                </div>
                <input
                  id='username'
                  type='text'
                  autoComplete='username'
                  className='block w-full rounded-xl border border-gray-900/12 bg-white/70 py-2.5 pl-10 pr-3 text-sm text-gray-900 backdrop-blur-sm transition-colors placeholder:text-gray-400 focus:border-green-500/70 focus:outline-none focus:ring-2 focus:ring-green-500/40 dark:border-white/10 dark:bg-gray-900/55 dark:text-gray-100 dark:placeholder:text-gray-500'
                  placeholder='请输入用户名'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor='password'
              className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
            >
              密码
            </label>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                <Lock className='h-4 w-4 text-gray-400' />
              </div>
              <input
                id='password'
                type='password'
                autoComplete='current-password'
                className='block w-full rounded-xl border border-gray-900/12 bg-white/70 py-2.5 pl-10 pr-3 text-sm text-gray-900 backdrop-blur-sm transition-colors placeholder:text-gray-400 focus:border-green-500/70 focus:outline-none focus:ring-2 focus:ring-green-500/40 dark:border-white/10 dark:bg-gray-900/55 dark:text-gray-100 dark:placeholder:text-gray-500'
                placeholder='请输入访问密码'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className='flex items-center gap-2 rounded-xl border border-red-400/35 bg-red-50/80 p-3 dark:bg-red-500/10'>
              <AlertCircle className='h-4 w-4 text-red-600 dark:text-red-400 shrink-0' />
              <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type='submit'
            disabled={!password || loading || (shouldAskUsername && !username)}
            className='btn-gold w-full py-2.5 text-sm'
          >
            <Lock className='h-4 w-4' />
            {loading ? '登录中...' : '立即登录'}
          </button>

          {/* 注册链接 */}
          {shouldAskUsername && (
            <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
              <p className='text-center text-gray-500 dark:text-gray-400 text-sm mb-2'>
                还没有账户？
              </p>
              <Link
                href='/register'
                prefetch={true}
                className='btn-ghost w-full px-4 py-2 text-sm'
              >
                <UserPlus className='w-4 h-4' />
                <span>立即注册</span>
              </Link>
            </div>
          )}
        </form>

        {/* OIDC 登录 */}
        {oidcEnabled && shouldAskUsername && (
          <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <div className='relative'>
              <div className='absolute inset-0 flex items-center'>
                <div className='w-full border-t border-gray-300 dark:border-gray-600'></div>
              </div>
              <div className='relative flex justify-center text-sm'>
                <span className='rounded-full border border-gray-900/10 bg-white/80 px-3 py-0.5 text-xs text-gray-500 backdrop-blur-sm dark:border-white/10 dark:bg-gray-900/80 dark:text-gray-400'>
                  或
                </span>
              </div>
            </div>

            {oidcProviders.length > 0 ? (
              <div className='mt-3 space-y-2'>
                {oidcProviders.map((provider) => {
                  const providerId = provider.id.toLowerCase();
                  const detectedProvider = [
                    'google',
                    'github',
                    'microsoft',
                    'facebook',
                    'wechat',
                    'apple',
                    'linuxdo',
                  ].includes(providerId)
                    ? (providerId as
                        | 'google'
                        | 'github'
                        | 'microsoft'
                        | 'facebook'
                        | 'wechat'
                        | 'apple'
                        | 'linuxdo')
                    : detectProvider(provider.issuer || provider.buttonText);
                  const buttonStyle = getProviderButtonStyle(detectedProvider);
                  const customText =
                    provider.buttonText &&
                    provider.buttonText !== '使用OIDC登录'
                      ? provider.buttonText
                      : undefined;
                  const buttonText = getProviderButtonText(
                    detectedProvider,
                    customText,
                  );

                  return (
                    <button
                      key={provider.id}
                      type='button'
                      onClick={() =>
                        (window.location.href = `/api/auth/oidc/login?provider=${provider.id}`)
                      }
                      className={`w-full inline-flex justify-center items-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${buttonStyle}`}
                    >
                      <OIDCProviderLogo provider={detectedProvider} />
                      <span className='ml-2'>{buttonText}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              (() => {
                const provider = detectProvider(oidcIssuer || oidcButtonText);
                const buttonStyle = getProviderButtonStyle(provider);
                const customText =
                  oidcButtonText && oidcButtonText !== '使用OIDC登录'
                    ? oidcButtonText
                    : undefined;
                const buttonText = getProviderButtonText(provider, customText);

                return (
                  <button
                    type='button'
                    onClick={() =>
                      (window.location.href = '/api/auth/oidc/login')
                    }
                    className={`mt-3 w-full inline-flex justify-center items-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${buttonStyle}`}
                  >
                    <OIDCProviderLogo provider={provider} />
                    <span className='ml-2'>{buttonText}</span>
                  </button>
                );
              })()
            )}
          </div>
        )}
      </div>

      <VersionDisplay />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageClient />
    </Suspense>
  );
}
