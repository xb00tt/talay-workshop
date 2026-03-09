'use client'

interface Props {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (p: number) => void
  className?: string
}

export default function Pagination({ page, totalPages, total, pageSize, onPageChange, className }: Props) {
  if (totalPages <= 1 && total <= pageSize) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className={`flex items-center justify-between gap-4 px-5 py-3 border-t border-gray-300 dark:border-gray-800 text-sm ${className ?? ''}`}>
      <span className="text-gray-500">
        {from}–{to} от {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ←
        </button>
        <span className="px-3 py-1.5 text-gray-500 dark:text-gray-400 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          →
        </button>
      </div>
    </div>
  )
}
