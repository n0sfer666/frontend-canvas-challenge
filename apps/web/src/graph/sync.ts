import type { GraphData, GraphSnapshot } from '@/api/types';

import { isApiError } from '@/api/errors';

import { sameGraph } from './serialize';

export type SyncStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

export type SyncState = { status: 'saved' | 'pending' | 'saving' } | { status: 'error' | 'conflict'; error: unknown };

export type FlushResult = { graph: GraphData | null; etag: string };

type Options = {
  etag: string;
  debounceMs: number;
  graph?: GraphData;
  save: (input: { graph: GraphData; etag: string }) => Promise<GraphSnapshot>;
  onState?: (state: SyncState) => void;
};

const isConflict = (error: unknown) => isApiError(error) && (error.status === 412 || error.status === 428);

export const createGraphSync = ({ etag, graph, debounceMs, save, onState }: Options) => {
  let version = etag;
  let saved: GraphData | null = graph ?? null;
  let draft: GraphData | null = null;
  let state: SyncState = { status: 'saved' };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<void> | null = null;
  let disposed = false;

  const publish = (next: SyncState) => {
    state = next;
    onState?.(next);
  };

  const stopTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const failed = () => state.status === 'error' || state.status === 'conflict';

  const pump = (): Promise<void> => {
    if (inflight) return inflight;
    if (disposed || draft === null) return Promise.resolve();

    const sending = draft;

    draft = null;
    stopTimer();
    publish({ status: 'saving' });

    inflight = save({ graph: sending, etag: version })
      .then((snapshot) => {
        inflight = null;
        version = snapshot.etag;
        saved = snapshot.graph;
        if (draft !== null) return pump();
        publish({ status: 'saved' });

        return undefined;
      })
      .catch((error: unknown) => {
        inflight = null;
        if (draft === null) draft = sending;
        publish({ status: isConflict(error) ? 'conflict' : 'error', error });
      });

    return inflight;
  };

  const flush = async (): Promise<FlushResult> => {
    stopTimer();
    for (;;) {
      if (disposed) break;
      if (inflight) {
        await inflight;
        if (failed()) break;
        continue;
      }
      if (draft === null) break;
      await pump();
      if (failed()) break;
    }
    if (state.status === 'error' || state.status === 'conflict') throw state.error;

    return { graph: saved, etag: version };
  };

  return {
    schedule: (next: GraphData) => {
      if (disposed) return;
      if (draft === null && saved !== null && sameGraph(saved, next)) return;
      draft = next;
      if (state.status === 'conflict') return;
      publish({ status: 'pending' });
      stopTimer();
      timer = setTimeout(() => void pump(), debounceMs);
    },
    flush,
    retry: flush,
    reset: (snapshot: GraphSnapshot) => {
      stopTimer();
      draft = null;
      version = snapshot.etag;
      saved = snapshot.graph;
      publish({ status: 'saved' });
    },
    etag: () => version,
    draft: () => draft,
    state: () => state,
    resume: () => {
      disposed = false;
    },
    dispose: () => {
      disposed = true;
      stopTimer();
    },
  };
};

export type GraphSync = ReturnType<typeof createGraphSync>;
