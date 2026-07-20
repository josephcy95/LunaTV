/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface CapsuleSwitchProps {
  options: { label: string; value: string }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Nocturne 分段切换：玻璃胶囊容器 + 滑动的金色月光指示块。
 */
const CapsuleSwitch: React.FC<CapsuleSwitchProps> = ({
  options,
  active,
  onChange,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    ready: false,
  });

  const activeIndex = options.findIndex((opt) => opt.value === active);

  const measure = () => {
    const btn = buttonRefs.current[activeIndex];
    const container = containerRef.current;
    if (!btn || !container) return;
    const btnRect = btn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setIndicator({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
      ready: true,
    });
  };

  useLayoutEffect(measure, [activeIndex, options.length]);

  useEffect(() => {
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      className={`glass-panel relative inline-flex items-center gap-0.5 rounded-full p-1 ${
        className || ''
      }`}
    >
      {/* 滑动金块 */}
      {indicator.ready && (
        <span
          aria-hidden='true'
          className='absolute top-1 bottom-1 rounded-full bg-linear-to-b from-green-300 to-green-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_2px_10px_rgba(209,159,48,0.4)] transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {options.map((opt, i) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
              isActive
                ? 'text-green-950'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default CapsuleSwitch;
