// Static server for the bench: serves lab/ (so the page can fetch ../../3x3/scrambles).
//   node scripts/serve.mjs [port] [--coi]   --coi adds COOP/COEP (cross-origin isolation)
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.txt': 'text/plain', '.json': 'application/json' }

export function serve(port = 0, coi = false) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
    const file = join(root, path)
    let st
    try {
      st = statSync(file)
    } catch {
      res.writeHead(404).end()
      return
    }
    if (!st.isFile()) {
      res.writeHead(404).end()
      return
    }
    const h = { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }
    if (coi) Object.assign(h, { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' })
    res.writeHead(200, h)
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +(process.argv[2] || 8125)
  await serve(port, process.argv.includes('--coi'))
  console.log(`http://127.0.0.1:${port}/speed/browser/bench/index.html`)
}
