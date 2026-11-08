import { parseAnimation, serializeAnimation } from '../animation/format'
import { defaultAnimation } from '../animation/defaults'
import type { Animation } from '../animation/types'

const KEY = 'wandlampe-lab-animation'

export function loadDraft(): Animation {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const result = parseAnimation(JSON.parse(raw))
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
