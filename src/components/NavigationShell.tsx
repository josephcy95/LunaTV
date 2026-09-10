'use client';

import { usePathname } from 'next/navigation';

import BrandMark from './BrandMark';
import ModernNav from './ModernNav';
import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

// 不需要导航栏的独立路由
const STANDALONE_ROUTES = [
  '/login',
  '/register',
  '/oidc-register',
  '/warning',
  '/source-test',
];

function isStandaloneRoute(pathname: string) {
  return STANDALONE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export default function NavigationShell() {
  const pathname = usePathname();
  const { siteName } = useSite();
  const isStandalone = isStandaloneRoute(pathname);

  // 独立路由不显示导航栏
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Modern Navigation - Top (Desktop) & Bottom (Mobile) */}
      <ModernNav />

      {/* 移动端头部 - Logo和用户菜单 */}
      <div className='md:hidden fixed top-0 left-0 right-0 z-40 border-b border-gray-900/8 bg-white/78 backdrop-blur-xl backdrop-saturate-150 dark:border-white/8 dark:bg-gray-950/72'>
        <div className='flex items-center justify-between h-11 px-4'>
          {/* Logo */}
          <BrandMark name={siteName} size='sm' />

          {/* Theme Toggle & User Menu */}
          <div className='flex items-center gap-1.5'>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </div>
    </>
  );
}
