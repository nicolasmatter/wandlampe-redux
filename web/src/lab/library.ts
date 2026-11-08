import { animationFileName, parseAnimation, serializeAnimation, type ParseResult } from '../animation/format'
import type { Animation } from '../animation/types'

/** Must match LAB_API in vite-lab-api.ts. */
const API = '/__lab/animations'

/** File names in the repo's animations folder, or null when the dev-server API isn't available. */
export async function listRepoAnimations(): Promise<string[] | null> {
  try {
    const res = await fetch(API)
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null
    const body = (await res.json()) as { files?: unknown }
    return Array.isArray(body.files) ? body.files.filter((f): f is string => typeof f === 'string') : null
  } catch {
    return null
  }
}

export async function openRepoAnimation(file: string): Promise<ParseResult> {
  const res = await fetch(`${API}/${encodeURIComponent(file)}`)
  if (!res.ok) return { ok: false, errors: [`Could not read ${file} (${res.status})`] }
  return parseText(await res.text())
}

/** Writes the animation to animations/<slug>.json and returns that file name. */
export async function saveRepoAnimation(animation: Animation): Promise<string> {
  const file = animationFileName(animation.name)
  const res = await fetch(`${API}/${file}`, { method: 'PUT', body: serializeAnimation(animation) })
  if (!res.ok) throw new Error(`Saving ${file} failed (${res.status})`)
  return file
}

export function parseText(text: string): ParseResult {
  try {
    return parseAnimation(JSON.parse(text))
  } catch {
    return { ok: false, errors: ['File is not valid JSON'] }
  }
}

export function downloadAnimation(animation: Animation) {
  const url = URL.createObjectURL(new Blob([serializeAnimation(animation)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = animationFileName(animation.name)
  a.click()
  URL.revokeObjectURL(url)
}
