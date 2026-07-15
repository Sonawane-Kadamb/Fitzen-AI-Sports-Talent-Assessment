/**
 * Minimal promise-based IndexedDB wrapper.
 *
 * Stores:
 *  - `outbox`   — signed assessment envelopes awaiting upload (offline-first queue)
 *  - `cache`    — last-known server responses for offline reads
 *  - `keys`     — the device's assessment signing keypair
 */

const DB_NAME = 'fitzen';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'clientId' });
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache');
      }
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
      }),
  );
}

export const idb = {
  get: <T>(store: string, key: IDBValidKey) =>
    tx<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
  put: (store: string, value: unknown, key?: IDBValidKey) =>
    tx(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key))),
  delete: (store: string, key: IDBValidKey) =>
    tx(store, 'readwrite', (s) => s.delete(key)),
  getAll: <T>(store: string) =>
    tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  count: (store: string) => tx<number>(store, 'readonly', (s) => s.count()),
  clear: (store: string) => tx(store, 'readwrite', (s) => s.clear()),
};

/** Cache a server response for offline reads. */
export async function cachePut(key: string, value: unknown): Promise<void> {
  await idb.put('cache', { value, cachedAt: Date.now() }, key);
}

export async function cacheGet<T>(key: string): Promise<{ value: T; cachedAt: number } | null> {
  const hit = await idb.get<{ value: T; cachedAt: number }>('cache', key);
  return hit ?? null;
}
