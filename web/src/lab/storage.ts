import { parseAnimation, serializeAnimation } from '../animation/format'
import { defaultAnimation } from '../animation/defaults'
import type { Animation } from '../animation/types'

const KEY = 'wandlampe-lab-animation'

/** Fills fields added after a draft was stored (mirror, noise contrast), so older drafts still open. */
function upgradeDraft(v: unknown): unknown {
  if (typeof v !== 'object' || v === null || !Array.isArray((v as { layers?: unknown }).layers)) return v
  const layers = (v as { layers: Record<string, unknown>[] }).layers.map(l => {
    const layer: Record<string, unknown> = { mirror: false, ...l }
    const params = layer.params as Record<string, unknown> | undefined
    if (layer.generator === 'noise' && params) {
      layer.params = { contrast: 1.8, ...params, scale: Math.max(1, Math.round(Number(params.scale) || 1)) }
    }
    return layer
  })
  return { ...v, layers }
}

export function loadDraft(): Animation {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const result = parseAnimation(upgradeDraft(JSON.parse(raw)))
      if (result.ok) return result.animation
    }
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return defaultAnimation()
}

export function saveDraft(animation: Animation) {
  try {
    localStorage.setItem(KEY, serializeAnimation(animation))
  } catch {
    // Storage full or disabled: the draft just won't persist.
  }
}
