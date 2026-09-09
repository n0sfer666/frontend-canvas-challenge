import type { GraphSnapshot } from '@/api/types';
import type { SaveMock } from '@/test/session';
import type { Mock } from 'vitest';

import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/errors';
import { setupSession as setup, settle } from '@/test/session';

describe('useSession: граф', () => {
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

  it('неудачное перечитывание графа объясняется и сохраняет черновик', async () => {
    const saveGraph: SaveMock = vi.fn(() =>
      Promise.reject(new ApiError({ status: 412, code: 'GRAPH_VERSION_CONFLICT' })),
    );
    const getGraph: Mock<() => Promise<GraphSnapshot>> = vi.fn(() =>
      Promise.reject(new ApiError({ status: 0, code: 'NETWORK_ERROR' })),
    );
    const { view } = setup({ saveGraph, getGraph });

    act(() => {
      view.result.current.addNode('prompt');
    });
    await settle();

    await act(async () => {
      await view.result.current.reload();
    });

    expect(view.result.current.notice).not.toBeNull();
    expect(view.result.current.nodes).toHaveLength(1);
    expect(view.result.current.save.status).toBe('conflict');
  });

  it('не добавляет ноды сверх лимита и объясняет причину', () => {
    const { view } = setup({ limits: { maxNodes: 2, maxEdges: 2 } });

    act(() => {
      view.result.current.addNode('prompt');
      view.result.current.addNode('generator');
      view.result.current.addNode('result');
    });

    expect(view.result.current.nodes).toHaveLength(2);
    expect(view.result.current.notice).toContain('2');
  });
});
