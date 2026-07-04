import { LucideIcon } from 'lucide-react';
import React from 'react';

interface SectionTitleProps {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
}

export default function SectionTitle({
  title,
  icon: Icon,
  iconColor = 'text-blue-500'
}: SectionTitleProps) {
  return (
    <div className="inline-block">
      <div className="flex items-center gap-2">
        {Icon && (
          <div className={iconColor}>
            <Icon size={24} strokeWidth={2.5} />
          </div>
        )}
        <h2 className="text-xl sm:text-2xl font-bold bg-linear-to-r from-gray-800 via-gray-700 to-gray-600 dark:from-gray-100 dark:via-gray-200 dark:to-gray-300 bg-clip-text text-transparent">
          {title}
        </h2>
      </div>
    </div>
  );
}
