import type { Section, ServiceStatus } from './types'
import { STAGE_ORDER } from './types'

export function fmtDate(iso: string) {
  const d  = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getUTCFullYear()}`
}

export function fmtDateTime(iso: string) {
  const d  = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}`
}

export function canDeleteSection(sec: Section) {
  if (sec.type === 'CHECKLIST' || sec.type === 'EQUIPMENT_CHECK') return false
  return !sec.workCards.some((wc) => wc.status !== 'PENDING' && wc.status !== 'CANCELLED')
}

export function resolvedStageState(
  stage: ServiceStatus,
  current: ServiceStatus,
): 'done' | 'active' | 'locked' {
  if (current === 'CANCELLED') return stage === 'SCHEDULED' ? 'done' : 'locked'
  const ci = STAGE_ORDER.indexOf(current)
  const si = STAGE_ORDER.indexOf(stage)
  if (si < ci)  return 'done'
  if (si === ci) return 'active'
  return 'locked'
}
