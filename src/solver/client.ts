import type { Comparison, FloorName, SolveReport } from './engine.ts'
import type { Reply, Request } from './protocol.ts'

type Pending = { resolve: (r: Reply) => void; reject: (e: Error) => void }
type Body = Request extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()

/** The solver runs in its own thread, so the cube keeps animating while it searches. */
function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<Reply>) => {
    const p = pending.get(e.data.id)
    if (!p) return
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

function call(body: Body): Promise<Reply> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ ...body, id } as Request)
  })
}

/** Builds the move tables and the two small floors (a few milliseconds). */
export async function initSolver(): Promise<number> {
  const r = await call({ type: 'init' })
  if (r.type !== 'ready') throw new Error('Unexpected reply')
  return r.ms
}

export async function solveRemote(
  moves: string[],
  floor: FloorName,
): Promise<{ report: SolveReport; buildMs: number }> {
  const r = await call({ type: 'solve', moves, floor })
  if (r.type !== 'solved') throw new Error('Unexpected reply')
  return { report: r.report, buildMs: r.buildMs }
}

export async function compareRemote(moves: string[]): Promise<Comparison> {
  const r = await call({ type: 'compare', moves })
  if (r.type !== 'compared') throw new Error('Unexpected reply')
  return r.comparison
}
