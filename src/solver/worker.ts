/// <reference lib="webworker" />
import { compareFloors, solve } from './engine.ts'
import type { Reply, Request } from './protocol.ts'
import { buildTables, ensureStrong, type Tables } from './tables.ts'

let tables: Tables | null = null
let buildMs = 0

function ready(): Tables {
  if (!tables) {
    const t0 = performance.now()
    tables = buildTables()
    buildMs = performance.now() - t0
  }
  return tables
}

self.onmessage = (e: MessageEvent<Request>) => {
  const msg = e.data
  let reply: Reply
  try {
    const t = ready()
    if (msg.type === 'init') reply = { id: msg.id, type: 'ready', ms: buildMs }
    else if (msg.type === 'solve') {
      // The strong floor's tables are built on first use, and that time is reported separately.
      let extra = 0
      if (msg.floor === 'strong' && !t.cornerFloors) {
        const t0 = performance.now()
        ensureStrong(t)
        extra = performance.now() - t0
      }
      reply = { id: msg.id, type: 'solved', report: solve(t, msg.moves, msg.floor), buildMs: extra }
    } else reply = { id: msg.id, type: 'compared', comparison: compareFloors(t, msg.moves) }
  } catch (err) {
    reply = { id: msg.id, type: 'error', message: err instanceof Error ? err.message : String(err) }
  }
  ;(self as unknown as Worker).postMessage(reply)
}
