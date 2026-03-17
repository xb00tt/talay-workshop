'use client';

import { useTranslations } from 'next-intl';

interface WarningBannerProps {
  type: 'warning' | 'success';
  title: string;
  description?: string;
  onDismiss?: () => void;
}

export default function WarningBanner({ type, title, description, onDismiss }: WarningBannerProps) {
  const t = useTranslations('service');

  const isWarning = type === 'warning';

  const bgClasses = isWarning
    ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50'
    : 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50';

  const titleClasses = isWarning
    ? 'text-sm font-semibold text-amber-800 dark:text-amber-200'
    : 'text-sm font-medium text-emerald-800 dark:text-emerald-200';

  const descClasses = isWarning
    ? 'text-xs text-amber-700 dark:text-amber-300 mt-0.5'
    : 'text-xs text-emerald-700 dark:text-emerald-300 mt-0.5';

  const iconClasses = isWarning
    ? 'w-5 h-5 text-amber-500 dark:text-amber-400'
    : 'w-5 h-5 text-emerald-500 dark:text-emerald-400';

  return (
    <div className={`mx-6 lg:mx-8 mt-4 rounded-xl ${bgClasses} px-4 py-3 flex items-start gap-3`}>
      <svg
        className={`${iconClasses} flex-shrink-0 mt-0.5`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        {isWarning ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        )}
      </svg>
      <div className="flex-1">
        <p className={titleClasses}>{title}</p>
        {description && <p className={descClasses}>{description}</p>}
      </div>
      {onDismiss && isWarning && (
        <button
          onClick={onDismiss}
          className="text-xs text-amber-700 dark:text-amber-300 font-medium underline underline-offset-2 flex-shrink-0 mt-0.5"
        >
          {t('continueAnyway')}
        </button>
      )}
    </div>
  );
}
