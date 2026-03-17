'use client'

export default function SmallBtn({ onClick, children, variant = 'default', disabled }: {
  onClick?: () => void; children: React.ReactNode
  variant?: 'default' | 'danger' | 'success' | 'primary'; disabled?: boolean
}) {
  const colors = {
    default: 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500',
    danger:  'border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 hover:border-red-400 dark:hover:border-red-600',
    success: 'border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 hover:border-green-400 dark:hover:border-green-600',
    primary: 'border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:border-blue-400 dark:hover:border-blue-500',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors disabled:opacity-40 ${colors[variant]}`}
    >
      {children}
    </button>
  )
}
