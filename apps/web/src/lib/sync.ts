/**
 * Offline-first sync engine.
 *
 * Assessments are signed and written to the IndexedDB outbox FIRST, then the
 * outbox is flushed to the server whenever connectivity allows (submit time,
 * `online` events, interval ticks). Server-side idempotency on clientId makes
 * retries safe. Listeners let the UI render live pending counts.
 */

import { api, OfflineError, type AssessmentEnvelope } from './api';
import { idb } from './idb';

export interface SyncState {
  pending: number;
  syncing: boolean;
  lastSyncAt: number | null;
  online: boolean;
}

type Listener = (state: SyncState) => void;

const listeners = new Set<Listener>();
let state: SyncState = {
  pending: 0,
  syncing: false,
  lastSyncAt: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
};

function emit(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

export function subscribeSync(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getSyncState(): SyncState {
  return state;
}

export async function refreshPendingCount(): Promise<void> {
  emit({ pending: await idb.count('outbox') });
}

/** Queue a signed envelope locally, then try to flush immediately. */
export async function enqueueAssessment(envelope: AssessmentEnvelope): Promise<void> {
  await idb.put('outbox', {
    clientId: envelope.signed.payload.clientId,
    envelope,
    queuedAt: Date.now(),
  });
  await refreshPendingCount();
  void flushOutbox();
}

let flushInFlight: Promise<void> | null = null;

export function flushOutbox(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = doFlush().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

async function doFlush(): Promise<void> {
  const items = await idb.getAll<{ clientId: string; envelope: AssessmentEnvelope }>('outbox');
  if (items.length === 0) {
    emit({ pending: 0 });
    return;
  }
  emit({ syncing: true });
  try {
    const { results } = await api.sync(items.map((i) => i.envelope));
    for (const result of results) {
      // created/duplicate → uploaded; validation errors won't succeed on
      // retry either, so drop them rather than poisoning the queue.
      if (result.clientId && result.status !== 'network_error') {
        await idb.delete('outbox', result.clientId);
      }
    }
    emit({ online: true, lastSyncAt: Date.now() });
  } catch (err) {
    if (err instanceof OfflineError) emit({ online: false });
    // Auth or server errors: keep the queue; a later flush will retry.
  } finally {
    emit({ syncing: false, pending: await idb.count('outbox') });
  }
}

/** Wire browser connectivity events + a slow safety interval. Idempotent. */
let started = false;
export function startSyncLoop(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => {
    emit({ online: true });
    void flushOutbox();
  });
  window.addEventListener('offline', () => emit({ online: false }));
  window.setInterval(() => void flushOutbox(), 45_000);
  void refreshPendingCount();
  void flushOutbox();
}
