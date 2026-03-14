'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EquipmentEntry {
  name: string
  description: string
}

interface WizardData {
  companyName: string
  companyAddress: string
  username: string
  managerName: string
  password: string
  confirmPassword: string
  mechanics: string[]
  equipmentItems: EquipmentEntry[]
  adrEquipmentItems: EquipmentEntry[]
  checklistItems: string[]
}

const STEPS = [
  'Информация за компанията',
  'Администраторски акаунт',
  'Механици',
  'Оборудване',
  'Чеклист шаблон',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
      {children}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white ' +
        'placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
        (props.className ?? '')
      }
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white ' +
        'placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ' +
        (props.className ?? '')
      }
    />
  )
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
    >
      <span className="text-lg leading-none">+</span> {label}
    </button>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-2 text-gray-500 hover:text-red-400 text-lg leading-none shrink-0"
      title="Премахни"
    >
      ×
    </button>
  )
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepCompanyInfo({
  data,
  onChange,
}: {
  data: WizardData
  onChange: (patch: Partial<WizardData>) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label required>Наименование на компанията</Label>
        <Input
          value={data.companyName}
          onChange={(e) => onChange({ companyName: e.target.value })}
          placeholder="Талай Транспорт ЕООД"
          autoFocus
        />
      </div>
      <div>
        <Label>Адрес</Label>
        <Textarea
          value={data.companyAddress}
          onChange={(e) => onChange({ companyAddress: e.target.value })}
          placeholder="гр. София, ул. Примерна 1"
          rows={2}
        />
      </div>
      <p className="text-xs text-gray-500">
        Тази информация ще се появява на разпечатките. Може да се промени по-късно от Настройки.
      </p>
    </div>
  )
}

function StepManagerAccount({
  data,
  onChange,
}: {
  data: WizardData
  onChange: (patch: Partial<WizardData>) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label required>Потребителско име</Label>
        <Input
          value={data.username}
          onChange={(e) => onChange({ username: e.target.value.toLowerCase().replace(/\s/g, '') })}
          placeholder="manager"
          autoComplete="username"
        />
        <p className="text-xs text-gray-500 mt-1">Само малки букви, без интервали.</p>
      </div>
      <div>
        <Label required>Пълно име</Label>
        <Input
          value={data.managerName}
          onChange={(e) => onChange({ managerName: e.target.value })}
          placeholder="Иван Иванов"
        />
      </div>
      <div>
        <Label required>Парола</Label>
        <Input
          type="password"
          value={data.password}
          onChange={(e) => onChange({ password: e.target.value })}
          placeholder="Минимум 8 символа"
          autoComplete="new-password"
        />
      </div>
      <div>
        <Label required>Потвърди паролата</Label>
        <Input
          type="password"
          value={data.confirmPassword}
          onChange={(e) => onChange({ confirmPassword: e.target.value })}
          placeholder="Повтори паролата"
          autoComplete="new-password"
        />
      </div>
    </div>
  )
}

function StepMechanics({
  data,
  onChange,
}: {
  data: WizardData
  onChange: (patch: Partial<WizardData>) => void
}) {
  const update = (i: number, val: string) => {
    const mechanics = [...data.mechanics]
    mechanics[i] = val
    onChange({ mechanics })
  }
  const add = () => onChange({ mechanics: [...data.mechanics, ''] })
  const remove = (i: number) => {
    if (data.mechanics.length === 1) return
    onChange({ mechanics: data.mechanics.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        Добавете механиците в екипа. Незадължително — може да добавите по-късно.
      </p>
      {data.mechanics.map((m, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={m}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Механик ${i + 1}`}
          />
          {data.mechanics.length > 1 && <RemoveButton onClick={() => remove(i)} />}
        </div>
      ))}
      <AddButton onClick={add} label="Добави механик" />
    </div>
  )
}

function EquipmentList({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string
  items: EquipmentEntry[]
  onChange: (items: EquipmentEntry[]) => void
  placeholder: string
}) {
  const update = (i: number, field: keyof EquipmentEntry, val: string) => {
    const next = items.map((item, idx) => (idx === i ? { ...item, [field]: val } : item))
    onChange(next)
  }
  const add = () => onChange([...items, { name: '', description: '' }])
  const remove = (i: number) => {
    if (items.length === 1) { onChange([{ name: '', description: '' }]); return }
    onChange(items.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">{label}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              <Input
                value={item.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                placeholder={placeholder}
              />
              <Input
                value={item.description}
                onChange={(e) => update(i, 'description', e.target.value)}
                placeholder="Описание (по избор)"
                className="text-sm"
              />
            </div>
            <RemoveButton onClick={() => remove(i)} />
          </div>
        ))}
      </div>
      <AddButton onClick={add} label="Добави позиция" />
    </div>
  )
}

function StepEquipment({
  data,
  onChange,
}: {
  data: WizardData
  onChange: (patch: Partial<WizardData>) => void
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        Дефинирайте оборудването, което се проверява при всеки сервиз. Незадължително — може да
        добавите по-късно.
      </p>
      <EquipmentList
        label="Стандартно оборудване"
        items={data.equipmentItems}
        onChange={(items) => onChange({ equipmentItems: items })}
        placeholder="Пожарогасител"
      />
      <EquipmentList
        label="ADR оборудване"
        items={data.adrEquipmentItems}
        onChange={(items) => onChange({ adrEquipmentItems: items })}
        placeholder="Защитен костюм"
      />
    </div>
  )
}

function StepChecklist({
  data,
  onChange,
}: {
  data: WizardData
  onChange: (patch: Partial<WizardData>) => void
}) {
  const update = (i: number, val: string) => {
    const items = [...data.checklistItems]
    items[i] = val
    onChange({ checklistItems: items })
  }
  const add = () => onChange({ checklistItems: [...data.checklistItems, ''] })
  const remove = (i: number) => {
    if (data.checklistItems.length === 1) return
    onChange({ checklistItems: data.checklistItems.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        Добавете стандартните задачи, които се копират автоматично при всеки сервиз. Незадължително
        — може да добавите по-късно.
      </p>
      {data.checklistItems.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Задача ${i + 1} (напр. Смяна на масло)`}
          />
          {data.checklistItems.length > 1 && <RemoveButton onClick={() => remove(i)} />}
        </div>
      ))}
      <AddButton onClick={add} label="Добави задача" />
    </div>
  )
}

function RecoveryCodeScreen({ code, onDone }: { code: string; onDone: () => void }) {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Настройката е завършена!</h2>
        <p className="text-gray-400 mt-1 text-sm">Запазете кода за възстановяване преди да продължите.</p>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-5 text-left">
        <p className="text-yellow-300 text-sm font-semibold mb-3">
          ⚠ Код за възстановяване на паролата
        </p>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 text-center">
          <span className="font-mono text-2xl font-bold tracking-widest text-gray-900 dark:text-white">{code}</span>
        </div>
        <p className="text-yellow-200/70 text-xs mt-3">
          Този код се показва само веднъж. Запишете го на сигурно място. Ще ви трябва ако забравите
          паролата си.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer text-left">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 w-4 h-4 accent-blue-500 shrink-0"
        />
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Записал/а съм кода за възстановяване на сигурно място.
        </span>
      </label>

      <button
        onClick={onDone}
        disabled={!confirmed}
        className="w-full py-3 rounded-xl font-semibold text-white transition-all
          bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
      >
        Отиди към вход
      </button>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

const initial: WizardData = {
  companyName: '',
  companyAddress: '',
  username: '',
  managerName: '',
  password: '',
  confirmPassword: '',
  mechanics: [''],
  equipmentItems: [{ name: '', description: '' }],
  adrEquipmentItems: [{ name: '', description: '' }],
  checklistItems: [''],
}

export default function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>(initial)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)

  const patch = (update: Partial<WizardData>) => setData((d) => ({ ...d, ...update }))

  function validate(): string {
    if (step === 1) {
      if (!data.companyName.trim()) return 'Въведете наименование на компанията.'
    }
    if (step === 2) {
      if (!data.username.trim()) return 'Въведете потребителско име.'
      if (!/^[a-z0-9_.-]+$/.test(data.username)) return 'Само малки букви, цифри, _ . -'
      if (!data.managerName.trim()) return 'Въведете пълно име.'
      if (data.password.length < 8) return 'Паролата трябва да е поне 8 символа.'
      if (data.password !== data.confirmPassword) return 'Паролите не съвпадат.'
    }
    return ''
  }

  function next() {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    if (step < STEPS.length) {
      setStep(step + 1)
    } else {
      submit()
    }
  }

  function back() {
    setError('')
    setStep(step - 1)
  }

  async function submit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Грешка при настройката.'); return }
      setRecoveryCode(json.recoveryCode)
    } catch {
      setError('Неуспешна връзка. Опитайте отново.')
    } finally {
      setLoading(false)
    }
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (recoveryCode) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl">
          <RecoveryCodeScreen code={recoveryCode} onDone={() => router.push('/login')} />
        </div>
      </div>
    )
  }

  const stepComponent = [
    <StepCompanyInfo key={1} data={data} onChange={patch} />,
    <StepManagerAccount key={2} data={data} onChange={patch} />,
    <StepMechanics key={3} data={data} onChange={patch} />,
    <StepEquipment key={4} data={data} onChange={patch} />,
    <StepChecklist key={5} data={data} onChange={patch} />,
  ][step - 1]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 dark:bg-gray-800 px-8 py-5">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Talay Workshop — Първоначална настройка</h1>
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i + 1 <= step ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Стъпка {step} от {STEPS.length} — {STEPS[step - 1]}
          </p>
        </div>

        {/* Content */}
        <div className="px-8 py-6">{stepComponent}</div>

        {/* Error */}
        {error && (
          <div className="mx-8 mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-8 pb-8 flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={back}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Назад
            </button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Запазване...' : step === STEPS.length ? 'Завърши' : 'Напред'}
          </button>
        </div>
      </div>
    </div>
  )
}
