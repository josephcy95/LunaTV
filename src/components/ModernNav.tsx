/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  Cat,
  Clover,
  Film,
  FolderOpen,
  Globe,
  Home,
  MoreHorizontal,
  PlaySquare,
  Radio,
  Search,
  Star,
  Tv,
  X,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, queryOptions } from '@tanstack/react-query';

import BrandMark from './BrandMark';
import { FastLink } from './FastLink';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { useSite } from './SiteProvider';

interface NavItem {
  icon: any;
  label: string;
  href: string;
}

// Query Options 工厂函数
const userEmbyConfigOptions = () =>
  queryOptions({
    queryKey: ['user', 'emby-config'],
    queryFn: async () => {
      const res = await fetch('/api/user/emby-config');
      if (!res.ok) return null;
      const data = await res.json();
      return data.config;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

const publicSourcesOptions = () =>
  queryOptions({
    queryKey: ['emby', 'public-sources'],
    queryFn: async () => {
      const res = await fetch('/api/emby/public-sources');
      if (!res.ok) return { sources: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

export default function ModernNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(pathname);
  const { siteName } = useSite();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const [menuItems, setMenuItems] = useState<NavItem[]>([
    { icon: Home, label: '首页', href: '/' },
    { icon: Search, label: '搜索', href: '/search' },
    { icon: Film, label: '电影', href: '/douban?type=movie' },
    { icon: Tv, label: '剧集', href: '/douban?type=tv' },
    { icon: Cat, label: '动漫', href: '/douban?type=anime' },
    { icon: Clover, label: '综艺', href: '/douban?type=show' },
    { icon: PlaySquare, label: '短剧', href: '/shortdrama' },
    { icon: Globe, label: '源浏览器', href: '/source-browser' },
  ]);

  // 检查用户是否配置了 Emby
  const { data: userEmbyConfig } = useQuery(userEmbyConfigOptions());

  // 检查管理员是否设置了公共源
  const { data: publicSourcesData } = useQuery(publicSourcesOptions());

  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    const newItems = [...menuItems];

    // 直播 - 根据 ENABLE_WEB_LIVE 动态控制
    const hasLiveInMenu = newItems.some((item) => item.href === '/live');
    if (runtimeConfig?.ENABLE_WEB_LIVE && !hasLiveInMenu) {
      newItems.push({ icon: Radio, label: '直播', href: '/live' });
    } else if (!runtimeConfig?.ENABLE_WEB_LIVE && hasLiveInMenu) {
      const index = newItems.findIndex((item) => item.href === '/live');
      if (index > -1) newItems.splice(index, 1);
    }

    if (
      runtimeConfig?.CUSTOM_CATEGORIES?.length > 0 &&
      !newItems.some((item) => item.href === '/douban?type=custom')
    ) {
      newItems.push({
        icon: Star,
        label: '自定义',
        href: '/douban?type=custom',
      });
    }

    // Emby - 用户有私人源 OR 管理员有公共源，都显示导航
    const hasUserEmby = userEmbyConfig?.sources?.some(
      (s: any) => s.enabled && s.ServerURL,
    );
    const hasPublicEmby = (publicSourcesData?.sources?.length ?? 0) > 0;
    const hasEmbyConfig = hasUserEmby || hasPublicEmby;
    const hasEmbyInMenu = newItems.some((item) => item.href === '/emby');

    if (hasEmbyConfig && !hasEmbyInMenu) {
      newItems.push({ icon: FolderOpen, label: 'Emby', href: '/emby' });
    } else if (!hasEmbyConfig && hasEmbyInMenu) {
      // 如果用户删除了所有 Emby 配置，移除导航项
      const index = newItems.findIndex((item) => item.href === '/emby');
      if (index > -1) {
        newItems.splice(index, 1);
      }
    }

    if (newItems.length !== menuItems.length) {
      setMenuItems(newItems);
    }
  }, [userEmbyConfig, publicSourcesData]);

  useEffect(() => {
    const queryString = searchParams.toString();
    const fullPath = queryString ? `${pathname}?${queryString}` : pathname;
    setActive(fullPath);
  }, [pathname, searchParams]);

  const isActive = (href: string) => {
    const typeMatch = href.match(/type=([^&]+)/)?.[1];
    const decodedActive = decodeURIComponent(active);
    const decodedHref = decodeURIComponent(href);

    return (
      decodedActive === decodedHref ||
      (decodedActive.startsWith('/douban') &&
        typeMatch &&
        decodedActive.includes(`type=${typeMatch}`))
    );
  };

  return (
    <>
      {/* ===== 桌面端顶栏 · Nocturne 玻璃檐 ===== */}
      <nav className='hidden md:block fixed top-0 left-0 right-0 z-50 border-b border-gray-900/8 bg-white/72 backdrop-blur-xl backdrop-saturate-150 dark:border-white/8 dark:bg-gray-950/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_0_rgba(215,219,233,0.06)]'>
        <div className='max-w-[2560px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20'>
          <div className='flex items-center justify-between h-16 gap-4'>
            {/* Logo */}
            <FastLink href='/' className='shrink-0'>
              <BrandMark name={siteName} size='md' />
            </FastLink>

            {/* 导航项：文字为主，金点指示当前位置 */}
            <div className='flex items-center justify-center gap-0.5 lg:gap-1 overflow-x-auto scrollbar-hide flex-1 px-4'>
              {menuItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <FastLink
                    key={item.label}
                    href={item.href}
                    useTransitionNav
                    onClick={() => setActive(item.href)}
                    className={`group relative flex items-center whitespace-nowrap shrink-0 rounded-full px-3.5 lg:px-4 py-2 text-sm transition-colors duration-200 ${
                      active
                        ? 'font-bold text-green-700 dark:text-green-300'
                        : 'font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-900/4 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                    {/* 当前位置的金色月点 */}
                    <span
                      aria-hidden='true'
                      className={`absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(230,185,74,0.9)] transition-all duration-300 dark:bg-green-400 ${
                        active ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                      }`}
                    />
                  </FastLink>
                );
              })}
            </div>

            {/* 右侧操作区 */}
            <div className='flex items-center gap-1.5 shrink-0'>
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* ===== 移动端「全部分类」抽屉 ===== */}
      {showMoreMenu && (
        <div
          className='md:hidden fixed inset-0 bg-black/55 backdrop-blur-sm animate-fadeIn'
          style={{ zIndex: 2147483647 }}
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className='glass-panel absolute bottom-24 left-3 right-3 overflow-hidden rounded-3xl animate-scaleIn'
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className='flex items-center justify-between px-6 pt-5 pb-3'>
              <div>
                <div className='eyebrow mb-0.5'>Collections</div>
                <h3 className='text-lg font-extrabold tracking-tight text-gray-900 dark:text-gray-100'>
                  全部分类
                </h3>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className='rounded-full border border-gray-900/10 p-2 text-gray-500 transition-colors hover:text-gray-900 dark:border-white/10 dark:text-gray-400 dark:hover:text-gray-100'
                aria-label='关闭'
              >
                <X className='w-4 h-4' />
              </button>
            </div>

            {/* All menu items in grid */}
            <div className='grid grid-cols-4 gap-3 p-4 pt-1'>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <FastLink
                    key={item.label}
                    href={item.href}
                    useTransitionNav
                    onClick={() => {
                      setActive(item.href);
                      setShowMoreMenu(false);
                    }}
                    className='flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors active:bg-gray-900/5 dark:active:bg-white/5'
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-200 ${
                        active
                          ? 'border-green-500/60 bg-linear-to-b from-green-300 to-green-500 shadow-[0_2px_12px_rgba(209,159,48,0.45)]'
                          : 'border-gray-900/8 bg-gray-900/4 dark:border-white/8 dark:bg-white/5'
                      }`}
                    >
                      <Icon
                        className={`h-5.5 w-5.5 ${
                          active
                            ? 'text-green-950'
                            : 'text-gray-600 dark:text-gray-300'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-xs ${
                        active
                          ? 'font-bold text-green-700 dark:text-green-300'
                          : 'font-medium text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {item.label}
                    </span>
                  </FastLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== 移动端浮岛 Dock ===== */}
      <nav
        className='md:hidden fixed left-3 right-3 z-40 glass-panel rounded-2xl'
        style={{
          bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className='flex items-center justify-around px-1.5 py-1.5'>
          {/* Show first 4 items + More button */}
          {menuItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <FastLink
                key={item.label}
                href={item.href}
                useTransitionNav
                onClick={() => setActive(item.href)}
                className='relative flex min-w-[56px] flex-1 flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-colors'
              >
                <Icon
                  className={`mb-0.5 h-5.5 w-5.5 transition-all duration-200 ${
                    active
                      ? 'text-green-600 drop-shadow-[0_0_5px_rgba(230,185,74,0.55)] dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                />
                <span
                  className={`text-[10px] leading-tight transition-colors ${
                    active
                      ? 'font-bold text-green-700 dark:text-green-300'
                      : 'font-medium text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </FastLink>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className='relative flex min-w-[56px] flex-1 flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-colors'
            aria-label='更多分类'
          >
            <MoreHorizontal className='mb-0.5 h-5.5 w-5.5 text-gray-500 dark:text-gray-400' />
            <span className='text-[10px] font-medium leading-tight text-gray-500 dark:text-gray-400'>
              更多
            </span>
          </button>
        </div>
      </nav>

      {/* Spacer for fixed navigation */}
      <div className='hidden md:block h-16' />
      <div className='md:hidden h-24' />
    </>
  );
}
