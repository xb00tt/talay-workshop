import Link from 'next/link'

interface EmptyStateProps {
  message: string
  hint?: string
  action?: { label: string; onClick: () => void } | { label: string; href: string }
}

export default function EmptyState({ message, hint, action }: EmptyStateProps) {
  return (
    <div className="px-5 py-14 flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-gray-500">{message}</p>
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
      {action && (
        'href' in action ? (
          <Link
            href={action.href}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
