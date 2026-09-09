import type { ResultView, Run } from './run';
import type { FlushResult } from './sync';
import type { StartGenerationInput } from '@/api/endpoints';
import type { GenerationData, GenerationScenario, GenerationStatus } from '@/api/types';

import { isApiError } from '@/api/errors';

import { createPoller } from './poller';

export type { Run, ResultView, RunRequest, RunStatus } from './run';

type Options = {
  spaceId: string;
  pollIntervalMs: number;
  maxPollFailures?: number;
  flush: () => Promise<FlushResult>;
  newKey: () => string;
  api: {
    startGeneration: (input: StartGenerationInput) => Promise<GenerationData>;
    getGeneration: (spaceId: string, generationId: string) => Promise<GenerationData>;
  };
  onChange?: () => void;
};

const isSettled = (status: GenerationStatus) => status !== 'processing';

const lostResponse = (error: unknown) => isApiError(error) && error.isNetwork;

const hopeless = (error: unknown) => isApiError(error) && error.status >= 400 && error.status < 500;

const byCreatedAt = (a: GenerationData, b: GenerationData) => a.createdAt.localeCompare(b.createdAt);

export const createGenerations = ({
  spaceId,
  pollIntervalMs,
  maxPollFailures = 5,
  flush,
  newKey,
  api,
  onChange,
}: Options) => {
  const runs = new Map<string, Run>();
  const results = new Map<string, ResultView>();
  const failures = new Map<string, number>();
  const poller = createPoller({ intervalMs: pollIntervalMs });
  let attempts = 0;

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

  const schedule = (generatorId: string) => {
    poller.schedule(generatorId, () => {
      void poll(generatorId);
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
    if (isSettled(data.status)) poller.stop(generatorId);
    else schedule(generatorId);
  };

  const giveUp = (generatorId: string, attempt: number, error: unknown) => {
    poller.stop(generatorId);
    failures.delete(generatorId);
    patch(generatorId, attempt, { status: 'error', error });
  };

  const poll = async (generatorId: string) => {
    const run = runs.get(generatorId);

    if (poller.stopped() || run?.generationId == null) return;
    try {
      apply(generatorId, await api.getGeneration(spaceId, run.generationId));
      failures.delete(generatorId);
    } catch (error) {
      const seen = (failures.get(generatorId) ?? 0) + 1;

      failures.set(generatorId, seen);
      if (hopeless(error) || seen >= maxPollFailures) giveUp(generatorId, run.attempt, error);
      else schedule(generatorId);
    }
  };

  const resumeOf = (previous: Run | undefined) => {
    if (previous === undefined || previous.status !== 'error') return null;
    if (!lostResponse(previous.error) || previous.request === null) return null;

    return { key: previous.key, request: previous.request };
  };

  const start = async (generatorId: string, scenario: GenerationScenario) => {
    const previous = runs.get(generatorId);
    const resumed = resumeOf(previous);
    const key = resumed?.key ?? newKey();

    attempts += 1;
    const attempt = attempts;

    poller.stop(generatorId);
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
      request: resumed?.request ?? null,
    });
    onChange?.();
    try {
      const request = resumed?.request ?? { graphETag: (await flush()).etag, scenario };

      patch(generatorId, attempt, { status: 'starting', request });
      const data = await api.startGeneration({
        spaceId,
        nodeId: generatorId,
        graphETag: request.graphETag,
        scenario: request.scenario,
        idempotencyKey: key,
      });

      if (!poller.stopped()) apply(generatorId, data);
    } catch (error) {
      patch(generatorId, attempt, { status: 'error', error });
    }
  };

  const adopt = (list: readonly GenerationData[]) => {
    if (list.length === 0) return;
    for (const data of [...list].sort(byCreatedAt)) {
      attempts += 1;
      poller.stop(data.nodeId);
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
        request: { graphETag: data.graphETag, scenario: data.scenario },
      });
      remember(data, attempts);
      if (!isSettled(data.status)) schedule(data.nodeId);
    }
    onChange?.();
  };

  const forget = (nodeId: string) => {
    const run = runs.get(nodeId);

    poller.stop(nodeId);
    failures.delete(nodeId);
    runs.delete(nodeId);
    results.delete(nodeId);
    if (run?.resultNodeId != null) results.delete(run.resultNodeId);
  };

  return {
    start,
    adopt,
    forget,
    resume: poller.resume,
    dispose: poller.dispose,
    runFor: (generatorId: string) => runs.get(generatorId) ?? null,
    resultFor: (resultNodeId: string) => results.get(resultNodeId) ?? null,
  };
};

export type Generations = ReturnType<typeof createGenerations>;
