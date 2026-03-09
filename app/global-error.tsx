'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', padding: '32px', textAlign: 'center', fontFamily: 'sans-serif', background: '#111', color: '#fff' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Нещо се обърка</h2>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>{error.message || 'Възникна неочаквана грешка.'}</p>
          <button
            onClick={reset}
            style={{ padding: '8px 16px', background: '#1f2937', border: 'none', borderRadius: '8px', color: '#d1d5db', fontSize: '14px', cursor: 'pointer' }}
          >
            Опитай отново
          </button>
        </div>
      </body>
    </html>
  )
}
