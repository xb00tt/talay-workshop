'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Stage = 'form' | 'success'

export default function RecoverPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('form')
  const [username, setUsername] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('Паролата трябва да е поне 8 символа.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Паролите не съвпадат.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, recoveryCode: recoveryCode.toUpperCase(), newPassword }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); return }
      setStage('success')
    } catch {
      setError('Неуспешна връзка. Опитайте отново.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl">
          {stage === 'success' ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Паролата е сменена</h2>
                <p className="text-gray-400 text-sm mt-1">Вече можете да влезете с новата парола.</p>
              </div>
              <button
                onClick={() => router.push('/login')}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
              >
                Към вход
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h1 className="text-lg font-bold text-white">Възстановяване на парола</h1>
                <p className="text-gray-400 text-sm mt-1">
                  Въведете кода за възстановяване, получен при създаване на акаунта.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Потребителско име
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white
                      placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="потребителско_име"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Код за възстановяване
                  </label>
                  <input
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    required
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white
                      font-mono tracking-widest placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="XXXXXXXXXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Нова парола
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white
                      placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="Минимум 8 символа"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Потвърди паролата
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white
                      placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="Повтори паролата"
                  />
                </div>

                {error && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold
                    transition-colors disabled:opacity-50"
                >
                  {loading ? 'Обработване...' : 'Смени паролата'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/login" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                  ← Назад към вход
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
