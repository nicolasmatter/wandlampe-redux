import { useEffect, useRef, useState } from 'react'
import { animationFileName, type ParseResult } from '../animation/format'
import type { Animation } from '../animation/types'
import { downloadAnimation, listRepoAnimations, openRepoAnimation, parseText, saveRepoAnimation } from './library'

type Props = {
  animation: Animation
  onOpen: (animation: Animation) => void
}

type Message = { kind: 'ok' | 'error'; text: string; details?: string[] }

/**
 * Saving and opening. With the dev server, files live in the repo's animations
 * folder; elsewhere, animations are downloaded and uploaded as JSON.
 */
export function LibraryPanel({ animation, onOpen }: Props) {
  const [files, setFiles] = useState<string[] | null | undefined>(undefined)
  const [message, setMessage] = useState<Message | null>(null)
  const upload = useRef<HTMLInputElement>(null)

  const refresh = () => listRepoAnimations().then(setFiles)
  useEffect(() => {
    void refresh()
  }, [])

  const accept = (result: ParseResult, source: string) => {
    if (result.ok) {
      onOpen(result.animation)
      setMessage({ kind: 'ok', text: `Opened ${source}` })
    } else {
      setMessage({ kind: 'error', text: `${source} is not a valid animation; nothing was changed.`, details: result.errors })
    }
  }

  const save = async () => {
    const file = animationFileName(animation.name)
    if (files?.includes(file) && !confirm(`Overwrite animations/${file}?`)) return
    try {
      await saveRepoAnimation(animation)
      setMessage({ kind: 'ok', text: `Saved animations/${file}` })
      void refresh()
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    }
  }

  const repo = Array.isArray(files)

  return (
    <div className="lab-library">
      <div className="lab-params">
        {repo && (
          <>
            <button type="button" className="apply" onClick={save}>
              Save to animations/{animationFileName(animation.name)}
            </button>
            <label className="lab-inline">
              <span>Open</span>
              <select
                value=""
                onChange={async e => {
                  const file = e.target.value
                  if (file) accept(await openRepoAnimation(file), file)
                }}
              >
                <option value="">{files.length ? 'Choose a file…' : 'No saved animations'}</option>
                {files.map(f => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button type="button" onClick={() => downloadAnimation(animation)}>
          Download JSON
        </button>
        <button type="button" onClick={() => upload.current?.click()}>
          Upload JSON
        </button>
        <input
          ref={upload}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) accept(parseText(await file.text()), file.name)
          }}
        />
      </div>
      {files === null && (
        <p className="lab-hint">Saving to the repo needs the dev server (`npm run dev`). Here, use download and upload.</p>
      )}
      {message && (
        <div className={`lab-message ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          <p>{message.text}</p>
          {message.details && (
            <ul>
              {message.details.map(d => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
