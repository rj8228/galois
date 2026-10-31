/// <reference lib="webworker" />
import { solve3 } from './engine.ts'
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

const post = (reply: Reply) => (self as unknown as Worker).postMessage(reply)

self.onmessage = async (e: MessageEvent<Request>) => {
  const msg = e.data
  try {
    const t = ready()
    if (msg.type === 'init') post({ id: msg.id, type: 'ready', ms: buildMs })
    else {
      const report = await solve3(t, msg.moves, {
        budget: msg.budget,
        onRound: (round) => post({ id: msg.id, type: 'round', round }),
      })
      post({ id: msg.id, type: 'solved', report })
    }
  } catch (err) {
    post({ id: msg.id, type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
