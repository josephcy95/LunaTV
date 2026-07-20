'use client';

import { Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { isAIRecommendFeatureDisabled } from '@/lib/ai-recommend.client';

import BrandMark from './BrandMark';
import ModernNav from './ModernNav';
import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

const AIRecommendModal = dynamic(() => import('./AIRecommendModal'), {
  ssr: false,
  loading: () => null,
});

// 不需要导航栏的独立路由
const STANDALONE_ROUTES = [
  '/login',
  '/register',
  '/oidc-register',
  '/warning',
  '/source-test',
  '/watch-room/screen',
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

  // AI 推荐功能
  const [showAIRecommendModal, setShowAIRecommendModal] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(true);

  useEffect(() => {
    const disabled = isAIRecommendFeatureDisabled();
    setAiEnabled(!disabled);
  }, []);

  // 独立路由不显示导航栏
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Modern Navigation - Top (Desktop) & Bottom (Mobile) */}
      <ModernNav
        showAIButton={aiEnabled ?? false}
        onAIButtonClick={() => setShowAIRecommendModal(true)}
      />

      {/* 移动端头部 - Logo和用户菜单 */}
      <div className='md:hidden fixed top-0 left-0 right-0 z-40 border-b border-gray-900/8 bg-white/78 backdrop-blur-xl backdrop-saturate-150 dark:border-white/8 dark:bg-gray-950/72'>
        <div className='flex items-center justify-between h-11 px-4'>
          {/* Logo */}
          <BrandMark name={siteName} size='sm' />

          {/* AI Button, Theme Toggle & User Menu */}
          <div className='flex items-center gap-1.5'>
            {aiEnabled && (
              <button
                onClick={() => setShowAIRecommendModal(true)}
                className='rounded-full border border-purple-400/35 p-1.5 text-purple-600 transition-all duration-200 active:scale-95 hover:border-purple-400/70 hover:bg-purple-500/10 dark:text-purple-300'
                aria-label='AI 推荐'
              >
                <Sparkles className='h-4 w-4' />
              </button>
            )}
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </div>

      {/* AI 推荐弹窗 */}
      {showAIRecommendModal && (
        <AIRecommendModal
          isOpen={showAIRecommendModal}
          onClose={() => setShowAIRecommendModal(false)}
        />
      )}
    </>
  );
}
