import type { StartGenerationInput } from '@/api/endpoints';
import { isApiError } from '@/api/errors';
import type { GenerationData, GenerationScenario, GenerationStatus } from '@/api/types';
import type { FlushResult } from './sync';

export type RunStatus = 'saving' | 'starting' | GenerationStatus | 'error';

export type Run = {
  generatorId: string;
  resultNodeId: string | null;
  generationId: string | null;
  status: RunStatus;
  imageUrl: string | null;
  failureCode: string | null;
  error: unknown;
  key: string;
  attempt: number;
};

export type ResultView = {
  generationId: string;
  status: GenerationStatus;
  imageUrl: string | null;
  failureCode: string | null;
  attempt: number;
};

type Options = {
  spaceId: string;
  pollIntervalMs: number;
  flush: () => Promise<FlushResult>;
  newKey: () => string;
  api: {
    startGeneration: (input: StartGenerationInput) => Promise<GenerationData>;
    getGeneration: (spaceId: string, generationId: string) => Promise<GenerationData>;
  };
  onChange?: () => void;
};

const isSettled = (status: GenerationStatus) => status !== 'processing';

const isActive = (status: RunStatus) =>
  status === 'saving' || status === 'starting' || status === 'processing';

const lostResponse = (error: unknown) => isApiError(error) && error.isNetwork;

export const createGenerations = ({
  spaceId,
  pollIntervalMs,
  flush,
  newKey,
  api,
  onChange,
}: Options) => {
  const runs = new Map<string, Run>();
  const results = new Map<string, ResultView>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let attempts = 0;
  let disposed = false;

  const stopPoll = (generatorId: string) => {
    const timer = timers.get(generatorId);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(generatorId);
  };

  const patch = (generatorId: string, attempt: number, changes: Partial<Run>) => {
    const run = runs.get(generatorId);
    if (run === undefined || run.attempt !== attempt) return;
    runs.set(generatorId, { ...run, ...changes });
    onChange?.();
  };

  const remember = (data: GenerationData, attempt: number) => {
    const shown = results.get(data.resultNodeId);
    if (shown !== undefined && shown.attempt > attempt) return;
    results.set(data.resultNodeId, {
      generationId: data.id,
      status: data.status,
      imageUrl: data.imageUrl,
      failureCode: data.failureCode,
      attempt,
    });
  };

  const apply = (generatorId: string, data: GenerationData) => {
    const run = runs.get(generatorId);
    if (run === undefined) return;
    if (run.generationId !== null && run.generationId !== data.id) return;
    patch(generatorId, run.attempt, {
      generationId: data.id,
      resultNodeId: data.resultNodeId,
      status: data.status,
      imageUrl: data.imageUrl,
      failureCode: data.failureCode,
      error: null,
    });
    remember(data, run.attempt);
    if (isSettled(data.status)) stopPoll(generatorId);
    else schedule(generatorId);
  };

  const poll = async (generatorId: string) => {
    const run = runs.get(generatorId);
    if (disposed || run?.generationId == null) return;
    try {
      apply(generatorId, await api.getGeneration(spaceId, run.generationId));
    } catch {
      schedule(generatorId);
    }
  };

  function schedule(generatorId: string) {
    stopPoll(generatorId);
    if (disposed) return;
    timers.set(
      generatorId,
      setTimeout(() => {
        void poll(generatorId);
      }, pollIntervalMs),
    );
  }

  const start = async (generatorId: string, scenario: GenerationScenario) => {
    const previous = runs.get(generatorId);
    const reuse =
      previous !== undefined && previous.status === 'error' && lostResponse(previous.error);
    const key = reuse ? previous.key : newKey();
    attempts += 1;
    const attempt = attempts;
    stopPoll(generatorId);
    runs.set(generatorId, {
      generatorId,
      resultNodeId: previous?.resultNodeId ?? null,
      generationId: null,
      status: 'saving',
      imageUrl: null,
      failureCode: null,
      error: null,
      key,
      attempt,
    });
    onChange?.();
    try {
      const saved = await flush();
      patch(generatorId, attempt, { status: 'starting' });
      const data = await api.startGeneration({
        spaceId,
        nodeId: generatorId,
        graphETag: saved.etag,
        scenario,
        idempotencyKey: key,
      });
      if (!disposed) apply(generatorId, data);
    } catch (error) {
      patch(generatorId, attempt, { status: 'error', error });
    }
  };

  const adopt = (list: readonly GenerationData[]) => {
    if (list.length === 0) return;
    for (const data of list) {
      attempts += 1;
      stopPoll(data.nodeId);
      runs.set(data.nodeId, {
        generatorId: data.nodeId,
        resultNodeId: data.resultNodeId,
        generationId: data.id,
        status: data.status,
        imageUrl: data.imageUrl,
        failureCode: data.failureCode,
        error: null,
        key: data.id,
        attempt: attempts,
      });
      remember(data, attempts);
      if (!isSettled(data.status)) schedule(data.nodeId);
    }
    onChange?.();
  };

  const dispose = () => {
    disposed = true;
    for (const generatorId of [...timers.keys()]) stopPoll(generatorId);
  };

  return {
    start,
    adopt,
    dispose,
    runFor: (generatorId: string) => runs.get(generatorId) ?? null,
    resultFor: (resultNodeId: string) => results.get(resultNodeId) ?? null,
    busy: () => [...runs.values()].some((run) => isActive(run.status)),
  };
};

export type Generations = ReturnType<typeof createGenerations>;
