'use client'

import { useState, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Photo {
  id: number
  caption: string | null
  filePath: string
  createdAt: string
}

export interface NoteItem {
  id: number
  content: string
  userNameSnapshot: string
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  const d  = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}`
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ photos, index, onClose, onPrev, onNext }: {
  photos: Photo[]; index: number
  onClose: () => void; onPrev: () => void; onNext: () => void
}) {
  const photo = photos[index]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose} className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300">×</button>

        {/* Prev */}
        {index > 0 && (
          <button
            onClick={onPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 text-white text-3xl hover:text-gray-300 px-2"
          >‹</button>
        )}

        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/uploads/${photo.filePath.replace(/\\/g, '/')}`}
          alt={photo.caption ?? ''}
          className="max-h-[80vh] w-full object-contain rounded-lg"
        />
        {photo.caption && (
          <p className="text-center text-sm text-gray-400 mt-2">{photo.caption}</p>
        )}
        <p className="text-center text-xs text-gray-600 mt-1">
          {index + 1} / {photos.length}
        </p>

        {/* Next */}
        {index < photos.length - 1 && (
          <button
            onClick={onNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 text-white text-3xl hover:text-gray-300 px-2"
          >›</button>
        )}
      </div>
    </div>
  )
}

// ─── Photo Gallery ────────────────────────────────────────────────────────────

export function PhotoGallery({
  photos,
  uploadUrl,
  deleteUrlFor,
  canUpload,
  onPhotoAdded,
  onPhotoDeleted,
}: {
  photos: Photo[]
  uploadUrl: string
  deleteUrlFor: (id: number) => string
  canUpload: boolean
  onPhotoAdded: (p: Photo) => void
  onPhotoDeleted: (id: number) => void
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(''); setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch(uploadUrl, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setUploadError(json.error ?? 'Грешка при качване.'); return }
      onPhotoAdded(json.photo)
    } catch { setUploadError('Неуспешна връзка.') }
    finally   { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function handleDelete(photo: Photo) {
    if (!confirm('Изтриване на снимката?')) return
    await fetch(deleteUrlFor(photo.id), { method: 'DELETE' })
    onPhotoDeleted(photo.id)
    if (lightboxIdx !== null && photos[lightboxIdx]?.id === photo.id) setLightboxIdx(null)
  }

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">Снимки ({photos.length})</h2>
        {canUpload && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Качване...' : '+ Качи снимка'}
          </button>
        )}
      </div>

      {uploadError && (
        <div className="mx-5 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {uploadError}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {photos.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-500 text-center">Няма снимки.</p>
      ) : (
        <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {photos.map((photo, idx) => (
            <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden bg-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/uploads/${photo.filePath.replace(/\\/g, '/')}`}
                alt={photo.caption ?? ''}
                className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setLightboxIdx(idx)}
              />
              {canUpload && (
                <button
                  onClick={() => handleDelete(photo)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIdx((i) => Math.min(photos.length - 1, (i ?? 0) + 1))}
        />
      )}
    </div>
  )
}

// ─── Notes Section ────────────────────────────────────────────────────────────

export function NotesSection({
  notes,
  postUrl,
  canCreate,
  onNoteAdded,
}: {
  notes: NoteItem[]
  postUrl: string
  canCreate: boolean
  onNoteAdded: (n: NoteItem) => void
}) {
  const [content, setContent] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) { setError('Въведете бележка.'); return }
    setError(''); setSaving(true)
    try {
      const res  = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Грешка.'); return }
      onNoteAdded(json.note)
      setContent('')
    } catch { setError('Неуспешна връзка.') }
    finally   { setSaving(false) }
  }

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">Бележки</h2>
      </div>

      {notes.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500 text-center">Няма бележки.</p>
      ) : (
        <ul className="divide-y divide-gray-800">
          {notes.map((n) => (
            <li key={n.id} className="px-5 py-3">
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{n.content}</p>
              <p className="text-xs text-gray-600 mt-1">
                {n.userNameSnapshot} · {fmtDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canCreate && (
        <form onSubmit={submit} className="px-5 py-4 border-t border-gray-800 space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            placeholder="Добави бележка..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={saving || !content.trim()}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Запазване...' : 'Добави бележка'}
          </button>
        </form>
      )}
    </div>
  )
}
