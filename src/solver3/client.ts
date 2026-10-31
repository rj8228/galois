import type { Round, Solve3Report } from './engine.ts'
import type { Reply, Request } from './protocol.ts'

type Pending = { resolve: (r: Reply) => void; reject: (e: Error) => void; onRound?: (r: Round) => void }
type Body = Request extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()

/** The 3×3 solver runs in its own thread, so the page stays responsive while it proves. */
function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<Reply>) => {
    const p = pending.get(e.data.id)
    if (!p) return
    if (e.data.type === 'round') {
      p.onRound?.(e.data.round)
      return
    }
    pending.delete(e.data.id)
    if (e.data.type === 'error') p.reject(new Error(e.data.message))
    else p.resolve(e.data)
  }
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'The solver stopped'))
    pending.clear()
    worker = null
  }
  return worker
}

function call(body: Body, onRound?: (r: Round) => void): Promise<Reply> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onRound })
    getWorker().postMessage({ ...body, id } as Request)
  })
}

/** Builds the move tables and the six floors (about 3.7 MB, under a second). */
export async function initSolver3(): Promise<number> {
  const r = await call({ type: 'init' })
  if (r.type !== 'ready') throw new Error('Unexpected reply')
  return r.ms
}

/** Solves the position these moves reach, looking at no more than `budget` positions. */
export async function solve3Remote(
  moves: string[],
  budget: number,
  onRound?: (r: Round) => void,
): Promise<Solve3Report & { ceilingMs: number }> {
  const r = await call({ type: 'solve', moves, budget }, onRound)
  if (r.type !== 'solved') throw new Error('Unexpected reply')
  return r.report
}
