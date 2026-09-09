import type { SaveGraphInput, StartGenerationInput } from '@/api/endpoints';
import type { GenerationData, GraphData, GraphSnapshot } from '@/api/types';
import type { ReactNode } from 'react';
import type { Mock } from 'vitest';

import { act, renderHook } from '@testing-library/react';
import { StrictMode, createElement } from 'react';
import { vi } from 'vitest';

import { useSession } from '@/app/useSession';

import { generationOf } from './generations';

export type SaveMock = Mock<(input: SaveGraphInput) => Promise<GraphSnapshot>>;
export type StartMock = Mock<(input: StartGenerationInput) => Promise<GenerationData>>;

const done = (): GenerationData =>
  generationOf({
    graphETag: '"v2"',
    status: 'succeeded',
    imageUrl: '/assets/demo.svg',
  });

const empty: GraphData = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

type Options = {
  saveGraph?: SaveMock;
  startGeneration?: StartMock;
  limits?: { maxNodes: number; maxEdges: number };
  strict?: boolean;
  getGraph?: Mock<() => Promise<GraphSnapshot>>;
};

const strictWrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);

export const setupSession = (options: Options = {}) => {
  const saveGraph: SaveMock =
    options.saveGraph ?? vi.fn((input) => Promise.resolve({ graph: input.graph, etag: '"v2"' }));
  const startGeneration: StartMock = options.startGeneration ?? vi.fn(() => Promise.resolve(done()));
  const getGraph =
    options.getGraph ??
    vi.fn(() =>
      Promise.resolve({
        graph: { ...empty, viewport: { x: 5, y: 5, zoom: 2 } },
        etag: '"server"',
      }),
    );
  const getGeneration = vi.fn(() => Promise.resolve(done()));
  const view = renderHook(
    () =>
      useSession({
        spaceId: 'space-1',
        snapshot: { graph: empty, etag: '"v1"' },
        config: {
          debounceMs: 500,
          pollIntervalMs: 500,
          maxNodes: options.limits?.maxNodes ?? 20,
          maxEdges: options.limits?.maxEdges ?? 20,
        },
        history: [],
        api: { saveGraph, getGraph, startGeneration, getGeneration },
      }),
    options.strict === true ? { wrapper: strictWrapper } : undefined,
  );

  return { view, saveGraph, startGeneration, getGraph };
};

export const settle = async (ms = 600) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
