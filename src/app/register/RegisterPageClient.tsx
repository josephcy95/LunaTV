/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { AlertCircle, CheckCircle, User, Lock, Sparkles, UserPlus, Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import BrandMark from '@/components/BrandMark';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

import { VersionDisplay } from './VersionDisplay';

interface RegisterPageClientProps {
  requireInviteCode: boolean;
}

function RegisterForm({ requireInviteCode }: RegisterPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bingWallpaper, setBingWallpaper] = useState<string>('');

  const { siteName } = useSite();

  // 获取 Bing 每日壁纸（通过代理 API）
  useEffect(() => {
    const fetchBingWallpaper = async () => {
      try {
        const response = await fetch('/api/bing-wallpaper');
        const data = await response.json();
        if (data.url) {
          setBingWallpaper(data.url);
        }
      } catch (error) {
        console.log('Failed to fetch Bing wallpaper:', error);
      }
    };

    fetchBingWallpaper();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!username || !password || !confirmPassword) {
      setError('请填写完整信息');
      return;
    }

    if (requireInviteCode && !inviteCode) {
      setError('请输入邀请码');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          confirmPassword,
          inviteCode: inviteCode || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // 显示成功消息，稍等一下再跳转
        setError(null);
        setSuccess('注册成功！正在跳转...');

        // Upstash 需要额外延迟等待数据同步
        const delay = data.needDelay ? 2500 : 1500;

        setTimeout(() => {
          const redirect = searchParams.get('redirect') || '/';
          router.replace(redirect);
        }, delay);
      } else {
        const data = await res.json();
        setError(data.error ?? '注册失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div translate="no" className='fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-3 py-8 sm:px-4 sm:py-10'>
      {/* Bing 每日壁纸背景（沉入夜色之下） */}
      {bingWallpaper && (
        <div
          className='absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60 transition-opacity duration-1000 dark:opacity-40'
          style={{ backgroundImage: `url(${bingWallpaper})` }}
        />
      )}

      {/* 夜幕叠加层：墨色 + 月晕 */}
      <div className='absolute inset-0 bg-linear-to-b from-black/45 via-black/30 to-black/60' />
      <div aria-hidden='true' className='pointer-events-none absolute inset-0 overflow-hidden'>
        <div className='absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-green-400/12 blur-[110px]' />
        <div className='absolute bottom-[-10rem] right-[-8rem] h-[24rem] w-[24rem] rounded-full bg-indigo-500/14 blur-[100px]' />
      </div>

      <div className='absolute top-3 right-3 sm:top-4 sm:right-4 z-20'>
        <ThemeToggle />
      </div>
      <div className='glass-panel relative z-10 my-auto w-full max-w-md animate-fade-in rounded-3xl p-6 sm:p-10'>
        {/* 标题区域 */}
        <div className='mb-6 text-center sm:mb-8'>
          <div className='mb-3 flex justify-center'>
            <BrandMark name={siteName} size='lg' />
          </div>
          <p className='eyebrow'>Join The Nocturne · 创建您的新账户</p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4 sm:space-y-5'>
          <div className='group'>
            <label htmlFor='username' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              用户名
            </label>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
                <User className='h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-green-600 dark:group-focus-within:text-green-400 transition-colors' />
              </div>
              <input
                id='username'
                type='text'
                autoComplete='username'
                className='block w-full rounded-xl border border-gray-900/12 bg-white/70 py-3 pl-12 pr-4 text-sm text-gray-900 backdrop-blur-sm transition-colors placeholder:text-gray-400 focus:border-green-500/70 focus:outline-none focus:ring-2 focus:ring-green-500/40 dark:border-white/10 dark:bg-gray-900/55 dark:text-gray-100 dark:placeholder:text-gray-500 sm:text-base'
                placeholder='3-20位字母数字下划线'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className='group'>
            <label htmlFor='password' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              密码
            </label>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
                <Lock className='h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-green-600 dark:group-focus-within:text-green-400 transition-colors' />
              </div>
              <input
                id='password'
                type='password'
                autoComplete='new-password'
                className='block w-full rounded-xl border border-gray-900/12 bg-white/70 py-3 pl-12 pr-4 text-sm text-gray-900 backdrop-blur-sm transition-colors placeholder:text-gray-400 focus:border-green-500/70 focus:outline-none focus:ring-2 focus:ring-green-500/40 dark:border-white/10 dark:bg-gray-900/55 dark:text-gray-100 dark:placeholder:text-gray-500 sm:text-base'
                placeholder='至少6位字符'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className='group'>
            <label htmlFor='confirmPassword' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              确认密码
            </label>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
                <Shield className='h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-green-600 dark:group-focus-within:text-green-400 transition-colors' />
              </div>
              <input
                id='confirmPassword'
                type='password'
                autoComplete='new-password'
                className='block w-full rounded-xl border border-gray-900/12 bg-white/70 py-3 pl-12 pr-4 text-sm text-gray-900 backdrop-blur-sm transition-colors placeholder:text-gray-400 focus:border-green-500/70 focus:outline-none focus:ring-2 focus:ring-green-500/40 dark:border-white/10 dark:bg-gray-900/55 dark:text-gray-100 dark:placeholder:text-gray-500 sm:text-base'
                placeholder='再次输入密码'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {requireInviteCode && (
            <div className='group'>
              <label htmlFor='inviteCode' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                邀请码
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
                  <Sparkles className='h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-green-600 dark:group-focus-within:text-green-400 transition-colors' />
                </div>
                <input
                  id='inviteCode'
                  type='text'
                  autoComplete='off'
                  className='block w-full rounded-xl border border-gray-900/12 bg-white/70 py-3 pl-12 pr-4 text-sm text-gray-900 backdrop-blur-sm transition-colors placeholder:text-gray-400 focus:border-green-500/70 focus:outline-none focus:ring-2 focus:ring-green-500/40 dark:border-white/10 dark:bg-gray-900/55 dark:text-gray-100 dark:placeholder:text-gray-500 sm:text-base uppercase'
                  placeholder='请输入邀请码'
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>
          )}

          {error && (
            <div className='flex items-center gap-2 rounded-xl border border-red-400/35 bg-red-50/80 p-3 dark:bg-red-500/10 animate-slide-down'>
              <AlertCircle className='h-4 w-4 text-red-600 dark:text-red-400 shrink-0' />
              <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
            </div>
          )}

          {success && (
            <div className='flex items-center gap-2 rounded-xl border border-green-500/35 bg-green-50/80 p-3 dark:bg-green-400/10 animate-slide-down'>
              <CheckCircle className='h-4 w-4 text-green-600 dark:text-green-400 shrink-0' />
              <p className='text-sm text-green-600 dark:text-green-400'>{success}</p>
            </div>
          )}

          <button
            type='submit'
            disabled={
              !username || !password || !confirmPassword || loading || !!success
            }
            className='btn-gold w-full py-3 text-base'
          >
            <UserPlus className='h-5 w-5' />
            {loading ? '注册中...' : success ? '注册成功，正在跳转...' : '立即注册'}
          </button>

          <div className='mt-6 pt-6 border-t border-gray-900/10 dark:border-white/10'>
            <p className='text-center text-gray-600 dark:text-gray-400 text-sm mb-3'>
              已有账户？
            </p>
            <Link
              href='/login'
              prefetch={true}
              className='btn-ghost group w-full px-6 py-2.5 text-sm'
            >
              <Lock className='w-4 h-4' />
              <span>立即登录</span>
              <span className='inline-block transition-transform group-hover:translate-x-1'>→</span>
            </Link>
          </div>
        </form>
      </div>

      <VersionDisplay />
    </div>
  );
}

export default function RegisterPageClient(props: RegisterPageClientProps) {
  return (
    <Suspense fallback={null}>
      <RegisterForm {...props} />
    </Suspense>
  );
}
