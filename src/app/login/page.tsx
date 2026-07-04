/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { AlertCircle, CheckCircle, User, Lock, UserPlus, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CURRENT_VERSION } from '@/lib/version';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';

import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { OIDCProviderLogo, detectProvider, getProviderButtonStyle, getProviderButtonText } from '@/components/OIDCProviderLogos';

function VersionDisplay() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const status = await checkForUpdates();
        setUpdateStatus(status);
      } catch (_) {
        // do nothing
      } finally {
        setIsChecking(false);
      }
    };

    checkUpdate();
  }, []);

  return (
    <div className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400'>
      <span className='font-mono'>v{CURRENT_VERSION}</span>
      {!isChecking && updateStatus !== UpdateStatus.FETCH_FAILED && (
        <div
          className={`flex items-center gap-1.5 ${updateStatus === UpdateStatus.HAS_UPDATE
            ? 'text-yellow-600 dark:text-yellow-400'
            : updateStatus === UpdateStatus.NO_UPDATE
              ? 'text-green-600 dark:text-green-400'
              : ''
            }`}
        >
          {updateStatus === UpdateStatus.HAS_UPDATE && (
            <>
              <AlertCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>有新版本</span>
            </>
          )}
          {updateStatus === UpdateStatus.NO_UPDATE && (
            <>
              <CheckCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>已是最新</span>
            </>
          )}
        </div>
      )}
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
  const shouldAskUsername = process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'localstorage';

  // Telegram Magic Link 状态
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramDeepLink, setTelegramDeepLink] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState('');

  // OIDC 登录状态
  const [oidcProviders, setOidcProviders] = useState<Array<{
    id: string;
    name: string;
    buttonText: string;
    issuer: string;
  }>>([]);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcButtonText, setOidcButtonText] = useState('使用OIDC登录');
  const [oidcIssuer, setOidcIssuer] = useState<string>('');

  const { siteName } = useSite();

  // 获取 Telegram Magic Link 配置
  useEffect(() => {
    const fetchTelegramConfig = async () => {
      try {
        const response = await fetch('/api/server-config');
        const data = await response.json();
        if (data.TelegramAuthConfig?.enabled) {
          setTelegramEnabled(true);
        }

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

    fetchTelegramConfig();
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
            body: JSON.stringify({ loginTime })
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

  const handleTelegramLogin = async () => {
    setError(null);

    if (!telegramUsername || telegramUsername.trim() === '') {
      setError('请输入您的 Telegram 用户名');
      return;
    }

    setTelegramLoading(true);

    try {
      const res = await fetch('/api/telegram/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUsername: telegramUsername.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.deepLink) {
        setTelegramDeepLink(data.deepLink);
        window.open(data.deepLink, '_blank');
      } else {
        setError(data.error || '生成链接失败，请重试');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setTelegramLoading(false);
    }
  };

  return (
    <div translate="no" className='fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4 py-8 sm:py-0 bg-gray-50 dark:bg-gray-950'>
      <div className='absolute top-3 right-3 sm:top-4 sm:right-4 z-20'>
        <ThemeToggle />
      </div>

      <div className='relative z-10 w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-lg p-6 sm:p-8 border border-gray-200 dark:border-gray-800'>
        {/* 标题 */}
        <div className='text-center mb-6 sm:mb-8'>
          <h1 className='text-gray-900 dark:text-white text-2xl sm:text-3xl font-bold mb-1'>
            {siteName}
          </h1>
          <p className='text-gray-500 dark:text-gray-400 text-sm'>请登录您的账户</p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {shouldAskUsername && (
            <div>
              <label htmlFor='username' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
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
                  className='block w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-sm bg-white dark:bg-gray-800'
                  placeholder='请输入用户名'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor='password' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
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
                className='block w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-sm bg-white dark:bg-gray-800'
                placeholder='请输入访问密码'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className='flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'>
              <AlertCircle className='h-4 w-4 text-red-600 dark:text-red-400 shrink-0' />
              <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type='submit'
            disabled={!password || loading || (shouldAskUsername && !username)}
            className='w-full flex justify-center items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50'
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
                className='flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors'
              >
                <UserPlus className='w-4 h-4' />
                <span>立即注册</span>
              </Link>
            </div>
          )}
        </form>

        {/* Telegram Magic Link 登录 */}
        {telegramEnabled && (
          <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <p className='text-center text-gray-500 dark:text-gray-400 text-sm mb-3'>
              或使用 Telegram 登录
            </p>

            <div className='mb-3'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                Telegram 用户名
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <Send className='h-4 w-4 text-gray-400' />
                </div>
                <input
                  type='text'
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  placeholder='输入您的 Telegram 用户名'
                  className='block w-full pl-9 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white text-sm'
                  disabled={telegramLoading}
                />
              </div>
              <p className='mt-1.5 text-xs text-gray-500 dark:text-gray-400'>
                输入您的 Telegram 用户名（不含 @）
              </p>
            </div>

            <button
              onClick={handleTelegramLogin}
              disabled={telegramLoading || !telegramUsername.trim()}
              className='w-full flex justify-center items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50'
            >
              <Send className='h-4 w-4' />
              {telegramLoading ? '正在打开 Telegram...' : '通过 Telegram 登录'}
            </button>

            {telegramDeepLink && (
              <div className='mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50'>
                <p className='text-sm text-blue-800 dark:text-blue-200 mb-1'>
                  已在新标签页打开 Telegram
                </p>
                <p className='text-xs text-blue-600 dark:text-blue-300'>
                  如果没有自动打开，请点击{' '}
                  <a href={telegramDeepLink} target='_blank' rel='noopener noreferrer' className='underline font-semibold'>
                    这里
                  </a>
                </p>
              </div>
            )}
          </div>
        )}

        {/* OIDC 登录 */}
        {oidcEnabled && shouldAskUsername && (
          <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <div className='relative'>
              <div className='absolute inset-0 flex items-center'>
                <div className='w-full border-t border-gray-300 dark:border-gray-600'></div>
              </div>
              <div className='relative flex justify-center text-sm'>
                <span className='px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400'>或</span>
              </div>
            </div>

            {oidcProviders.length > 0 ? (
              <div className='mt-3 space-y-2'>
                {oidcProviders.map((provider) => {
                  const providerId = provider.id.toLowerCase();
                  const detectedProvider = ['google', 'github', 'microsoft', 'facebook', 'wechat', 'apple', 'linuxdo'].includes(providerId)
                    ? (providerId as 'google' | 'github' | 'microsoft' | 'facebook' | 'wechat' | 'apple' | 'linuxdo')
                    : detectProvider(provider.issuer || provider.buttonText);
                  const buttonStyle = getProviderButtonStyle(detectedProvider);
                  const customText = provider.buttonText && provider.buttonText !== '使用OIDC登录' ? provider.buttonText : undefined;
                  const buttonText = getProviderButtonText(detectedProvider, customText);

                  return (
                    <button
                      key={provider.id}
                      type='button'
                      onClick={() => window.location.href = `/api/auth/oidc/login?provider=${provider.id}`}
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
                const customText = oidcButtonText && oidcButtonText !== '使用OIDC登录' ? oidcButtonText : undefined;
                const buttonText = getProviderButtonText(provider, customText);

                return (
                  <button
                    type='button'
                    onClick={() => window.location.href = '/api/auth/oidc/login'}
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
