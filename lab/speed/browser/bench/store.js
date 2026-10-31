// Table store: IndexedDB, one record per table file, keyed "<name>.<bits>" (for example
// "phase1_sym.4"). Any other kind of table (T3's downhill masks, say "mask_p1.1") is just another
// key with its own bytes and meta, so the store needs no change to hold them.
//
// Works in the page and in workers (IndexedDB is available in both).

const DB = 'galois-speed-tables'
const STORE = 'tables'
const VERSION = 1

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const out = fn(t.objectStore(STORE))
        t.oncomplete = () => {
          db.close()
          resolve(out instanceof IDBRequest ? out.result : out)
        }
        t.onerror = t.onabort = () => {
          db.close()
          reject(t.error)
        }
      }),
  )
}

/** Stores bytes (Uint8Array) with meta (an object: entries, depth, counts, build_ms, ...). */
export function put(key, bytes, meta = {}) {
  return tx('readwrite', (s) => s.put({ bytes: bytes.buffer.byteLength === bytes.length ? bytes.buffer : bytes.slice().buffer, meta, stored: Date.now() }, key))
}

/** {bytes: Uint8Array, meta} or null. */
export async function get(key) {
  const rec = await tx('readonly', (s) => s.get(key))
  return rec ? { bytes: new Uint8Array(rec.bytes), meta: rec.meta } : null
}

export function keys() {
  return tx('readonly', (s) => s.getAllKeys())
}

export function clear() {
  return tx('readwrite', (s) => s.clear())
}
