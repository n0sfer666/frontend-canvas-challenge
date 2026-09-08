import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type { StartGenerationInput } from '@/api/endpoints';
import type { GenerationData } from '@/api/types';
import { createGenerations } from '@/graph/generation';
import type { FlushResult } from '@/graph/sync';

export type StartMock = Mock<(input: StartGenerationInput) => Promise<GenerationData>>;
export type ReadMock = Mock<(spaceId: string, generationId: string) => Promise<GenerationData>>;
export type FlushMock = Mock<() => Promise<FlushResult>>;

export const generationOf = (patch: Partial<GenerationData> = {}): GenerationData => ({
  id: 'gen-1',
  spaceId: 'space-1',
  nodeId: 'g1',
  resultNodeId: 'r1',
  prompt: 'горы',
  graphETag: '"v1"',
  scenario: 'success',
  status: 'processing',
  createdAt: '2026-01-01T00:00:00.000Z',
  imageUrl: null,
  failureCode: null,
  links: {},
  ...patch,
});

type Options = {
  start?: StartMock;
  read?: ReadMock;
  flush?: FlushMock;
  maxPollFailures?: number;
};

export const setupGenerations = (options: Options = {}) => {
  const start: StartMock = options.start ?? vi.fn(() => Promise.resolve(generationOf()));
  const read: ReadMock = options.read ?? vi.fn(() => Promise.resolve(generationOf()));
  const flush: FlushMock =
    options.flush ?? vi.fn(() => Promise.resolve({ etag: '"v1"', graph: null }));
  let counter = 0;
  const runs = createGenerations({
    spaceId: 'space-1',
    pollIntervalMs: 500,
    maxPollFailures: options.maxPollFailures,
    flush,
    newKey: () => `key-${String(++counter)}`,
    api: { startGeneration: start, getGeneration: read },
    onChange: () => undefined,
  });
  return { runs, start, read, flush };
};
