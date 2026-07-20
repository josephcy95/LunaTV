'use client';

import { useId } from 'react';

/**
 * Nocturne 品牌标识：金色月牙 + 站名。
 * 月牙用内联 SVG 渐变绘制，hover 时泛起月晕。
 * 渐变 id 必须每实例唯一——重复 id 会解析到隐藏节点里的 defs 导致月牙变黑。
 */

interface BrandMarkProps {
  name: string;
  /** sm: 移动端/紧凑场景; md: 顶部导航; lg: 登录页 */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { icon: 'h-5 w-5', text: 'text-lg' },
  md: { icon: 'h-6 w-6', text: 'text-xl' },
  lg: { icon: 'h-10 w-10', text: 'text-4xl' },
} as const;

export function CrescentIcon({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      aria-hidden='true'
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1='4' y1='3' x2='20' y2='21'>
          <stop offset='0%' stopColor='#f2dc9d' />
          <stop offset='55%' stopColor='#e6b94a' />
          <stop offset='100%' stopColor='#96690a' />
        </linearGradient>
      </defs>
      <path
        d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z'
        fill={`url(#${gradientId})`}
        stroke='rgba(230,185,74,0.5)'
        strokeWidth='0.5'
      />
    </svg>
  );
}

export default function BrandMark({
  name,
  size = 'md',
  className = '',
}: BrandMarkProps) {
  const s = SIZES[size];
  return (
    <span
      className={`group/brand inline-flex select-none items-center gap-2.5 ${className}`}
    >
      <span className='relative inline-flex'>
        {/* 月晕 */}
        <span className='absolute inset-0 scale-150 rounded-full bg-green-400/35 opacity-0 blur-md transition-opacity duration-500 group-hover/brand:opacity-100' />
        <CrescentIcon
          className={`${s.icon} relative drop-shadow-[0_0_6px_rgba(230,185,74,0.35)] transition-transform duration-500 group-hover/brand:-rotate-12`}
        />
      </span>
      <span
        className={`${s.text} font-extrabold tracking-tight text-gray-900 transition-colors dark:text-gray-100`}
      >
        {name}
      </span>
    </span>
  );
}
