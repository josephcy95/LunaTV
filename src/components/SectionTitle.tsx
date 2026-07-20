import { LucideIcon } from 'lucide-react';
import React from 'react';

interface SectionTitleProps {
  title: string;
  /** 等宽英文眉题，如 "TRENDING FILMS" */
  eyebrow?: string;
  /** 兼容旧调用；新设计不再渲染彩色图标 */
  icon?: LucideIcon;
  iconColor?: string;
}

/**
 * Nocturne 编辑式段落标题：
 * 金色月点 + 等宽眉题，其下是加粗中文标题。
 */
export default function SectionTitle({
  title,
  eyebrow,
  icon: _icon,
  iconColor: _iconColor,
}: SectionTitleProps) {
  return (
    <div className='inline-block'>
      {eyebrow && (
        <div className='mb-1.5 flex items-center gap-2'>
          <span
            aria-hidden='true'
            className='inline-block h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(230,185,74,0.8)] dark:bg-green-400'
          />
          <span className='eyebrow'>{eyebrow}</span>
        </div>
      )}
      <h2 className='text-xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl'>
        {title}
      </h2>
    </div>
  );
}
