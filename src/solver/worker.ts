/// <reference lib="webworker" />
import { randomPosition, solve } from './engine.ts'
import type { Reply, Request } from './protocol.ts'
import { buildTables, type Tables } from './tables.ts'

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
    if (msg.type === 'init') reply = { id: msg.id, type: 'ready', rings: t.rings, ms: buildMs }
    else if (msg.type === 'solve') reply = { id: msg.id, type: 'solved', report: solve(t, msg.moves, msg.floor) }
    else reply = { id: msg.id, type: 'random', moves: randomPosition(t, msg.ring) }
  } catch (err) {
    reply = { id: msg.id, type: 'error', message: err instanceof Error ? err.message : String(err) }
  }
  ;(self as unknown as Worker).postMessage(reply)
}
