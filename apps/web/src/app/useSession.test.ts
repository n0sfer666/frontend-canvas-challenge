import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { SaveGraphInput, StartGenerationInput } from '@/api/endpoints';
import { ApiError } from '@/api/errors';
import type { GenerationData, GraphData, GraphSnapshot } from '@/api/types';
import { useSession } from './useSession';

type SaveMock = Mock<(input: SaveGraphInput) => Promise<GraphSnapshot>>;
type StartMock = Mock<(input: StartGenerationInput) => Promise<GenerationData>>;

const empty: GraphData = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

const generation = (patch: Partial<GenerationData> = {}): GenerationData => ({
  id: 'gen-1',
  spaceId: 'space-1',
  nodeId: 'g1',
  resultNodeId: 'r1',
  prompt: 'горы',
  graphETag: '"v2"',
  scenario: 'success',
  status: 'succeeded',
  createdAt: '2026-01-01T00:00:00.000Z',
  imageUrl: '/assets/demo.svg',
  failureCode: null,
  links: {},
  ...patch,
});

const setup = (options: { saveGraph?: SaveMock; startGeneration?: StartMock } = {}) => {
  const saveGraph: SaveMock =
    options.saveGraph ?? vi.fn((input) => Promise.resolve({ graph: input.graph, etag: '"v2"' }));
  const startGeneration: StartMock =
    options.startGeneration ?? vi.fn(() => Promise.resolve(generation()));
  const getGraph = vi.fn(() =>
    Promise.resolve({
      graph: { ...empty, viewport: { x: 5, y: 5, zoom: 2 } },
      etag: '"server"',
    }),
  );
  const getGeneration = vi.fn(() => Promise.resolve(generation()));
  const view = renderHook(() =>
    useSession({
      spaceId: 'space-1',
      snapshot: { graph: empty, etag: '"v1"' },
      config: { debounceMs: 500, pollIntervalMs: 500 },
      history: [],
      api: { saveGraph, getGraph, startGeneration, getGeneration },
    }),
  );
  return { view, saveGraph, startGeneration, getGraph };
};

const settle = async (ms = 600) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('useSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('серия правок даёт одно сохранение актуальной версией графа', async () => {
    const { view, saveGraph } = setup();

    act(() => {
      view.result.current.addNode('prompt');
      view.result.current.addNode('generator');
    });
    expect(view.result.current.nodes).toHaveLength(2);
    expect(view.result.current.save.status).toBe('pending');

    await settle();

    expect(saveGraph).toHaveBeenCalledOnce();
    expect(saveGraph.mock.calls[0]?.[0]).toMatchObject({ spaceId: 'space-1', etag: '"v1"' });
    expect(saveGraph.mock.calls[0]?.[0].graph.nodes).toHaveLength(2);
    expect(view.result.current.save.status).toBe('saved');
  });

  it('отклоняет несовместимую связь и объясняет следующее действие', () => {
    const { view } = setup();

    act(() => {
      view.result.current.addNode('prompt');
      view.result.current.addNode('result');
    });
    const [prompt, result] = view.result.current.nodes;
    act(() => {
      view.result.current.connect({ source: prompt?.id ?? '', target: result?.id ?? '' });
    });

    expect(view.result.current.edges).toHaveLength(0);
    expect(view.result.current.notice).not.toBeNull();
  });

  it('удаление ноды убирает её связи', () => {
    const { view } = setup();

    act(() => {
      view.result.current.addNode('prompt');
      view.result.current.addNode('generator');
    });
    const [prompt, generator] = view.result.current.nodes;
    act(() => {
      view.result.current.connect({ source: prompt?.id ?? '', target: generator?.id ?? '' });
    });
    expect(view.result.current.edges).toHaveLength(1);

    act(() => {
      view.result.current.removeNode(generator?.id ?? '');
    });

    expect(view.result.current.nodes).toHaveLength(1);
    expect(view.result.current.edges).toHaveLength(0);
  });

  it('генерация дожидается сохранения и запускает сохранённую версию', async () => {
    const { view, saveGraph, startGeneration } = setup();

    act(() => {
      view.result.current.addNode('prompt');
      view.result.current.addNode('generator');
      view.result.current.addNode('result');
    });
    const [prompt, generator, result] = view.result.current.nodes;
    act(() => {
      view.result.current.connect({ source: prompt?.id ?? '', target: generator?.id ?? '' });
      view.result.current.connect({ source: generator?.id ?? '', target: result?.id ?? '' });
      view.result.current.updateText(prompt?.id ?? '', 'горы на рассвете');
    });

    await act(async () => {
      await view.result.current.generate(generator?.id ?? '', 'success');
    });

    expect(saveGraph).toHaveBeenCalledOnce();
    expect(startGeneration).toHaveBeenCalledOnce();
    expect(startGeneration.mock.calls[0]?.[0]).toMatchObject({
      nodeId: generator?.id,
      graphETag: '"v2"',
    });
  });

  it('конфликт версии оставляет черновик и позволяет перечитать серверный граф', async () => {
    const saveGraph: SaveMock = vi.fn(() =>
      Promise.reject(new ApiError({ status: 412, code: 'GRAPH_VERSION_CONFLICT' })),
    );
    const { view, getGraph } = setup({ saveGraph });

    act(() => {
      view.result.current.addNode('prompt');
    });
    await settle();

    expect(view.result.current.save.status).toBe('conflict');
    expect(view.result.current.nodes).toHaveLength(1);

    await act(async () => {
      await view.result.current.reload();
    });

    expect(getGraph).toHaveBeenCalledOnce();
    expect(view.result.current.nodes).toHaveLength(0);
    expect(view.result.current.viewport.zoom).toBe(2);
    expect(view.result.current.save.status).toBe('saved');
  });
});
