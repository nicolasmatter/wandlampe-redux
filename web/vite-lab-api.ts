import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/** URL prefix of the Lab's dev-only animation API. */
export const LAB_API = '/__lab/animations'

const FILE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/
const MAX_BODY_BYTES = 256 * 1024

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new Error('body too large')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Lists, reads and writes `animations/*.json` in the repo while the dev server
 * runs. Not part of the production build; the Lab falls back to download/upload there.
 * The client validates animations; the server only checks file names and JSON syntax.
 */
export function labAnimationsApi(dir: string): Plugin {
  const root = resolve(dir)
  return {
    name: 'wandlampe-lab-animations',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(LAB_API, async (req, res) => {
        try {
          const name = decodeURIComponent((req.url ?? '/').replace(/^\/+/, '').split('?')[0])
          if (!name) {
            if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' })
            await mkdir(root, { recursive: true })
            const files = (await readdir(root)).filter(f => FILE_NAME.test(f)).sort()
            return send(res, 200, { files })
          }
          if (!FILE_NAME.test(name)) return send(res, 400, { error: 'invalid file name' })
          const path = resolve(root, name)
          if (req.method === 'GET') {
            const text = await readFile(path, 'utf8').catch(() => null)
            if (text === null) return send(res, 404, { error: 'not found' })
            res.setHeader('Content-Type', 'application/json')
            return res.end(text)
          }
          if (req.method === 'PUT') {
            const text = await readBody(req)
            JSON.parse(text)
            await mkdir(root, { recursive: true })
            await writeFile(path, text.endsWith('\n') ? text : text + '\n')
            return send(res, 200, { file: name })
          }
          return send(res, 405, { error: 'method not allowed' })
        } catch (e) {
          return send(res, 400, { error: e instanceof Error ? e.message : String(e) })
        }
      })
    },
  }
}
