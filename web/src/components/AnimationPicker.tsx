import { useRef, useState } from 'react'
import { parseAnimation } from '../animation/format'
import type { Animation } from '../animation/types'
import { BUNDLED_ANIMATIONS, bundledFile } from '../lampAnimations'

const CUSTOM = ''

type Props = {
  animation: Animation | undefined
  onChange: (animation: Animation) => void
}

/** Picks a committed animation, or uploads one exported from the Lab. */
export function AnimationPicker({ animation, onChange }: Props) {
  const upload = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<string[]>([])
  const selected = animation ? bundledFile(animation) ?? CUSTOM : CUSTOM

  async function readFile(file: File) {
    let json: unknown
    try {
      json = JSON.parse(await file.text())
    } catch {
      setErrors([`${file.name} is not valid JSON`])
      return
    }
    const result = parseAnimation(json)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    onChange(result.animation)
  }

  return (
    <>
      <div className="animation-picker">
        <label className="field-row">
          Animation
          <select
            value={selected}
            onChange={e => {
              const picked = BUNDLED_ANIMATIONS.find(b => b.file === e.target.value)
              if (picked) {
                setErrors([])
                onChange(picked.animation)
              }
            }}
          >
            {selected === CUSTOM && <option value={CUSTOM}>{animation ? `${animation.name} (uploaded)` : '—'}</option>}
            {BUNDLED_ANIMATIONS.map(b => (
              <option key={b.file} value={b.file}>
                {b.animation.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => upload.current?.click()}>
          Upload JSON…
        </button>
        <input
          ref={upload}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void readFile(file)
          }}
        />
      </div>
      {errors.length > 0 && (
        <ul className="animation-errors" role="alert">
          {errors.map(error => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </>
  )
}
