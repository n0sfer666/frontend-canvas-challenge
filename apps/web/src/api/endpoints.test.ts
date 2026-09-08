import { describe, expect, it, vi } from 'vitest';
import { createApi } from './endpoints';
import type { Http, HttpRequest } from './http';

const graph = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

const setup = (result: Partial<{ status: number; data: unknown; etag: string }> = {}) => {
  const calls: HttpRequest[] = [];
  const http = vi.fn((request: HttpRequest) => {
    calls.push(request);
    return Promise.resolve({
      status: result.status ?? 200,
      data: result.data ?? null,
      etag: result.etag ?? null,
      headers: new Headers(),
    });
  }) as unknown as Http;
  return { api: createApi(http), calls };
};

describe('createApi', () => {
  it('создаёт пространство', async () => {
    const { api, calls } = setup({ status: 201, data: { id: 'space-1' } });

    const space = await api.createSpace('Мой канвас');

    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/spaces',
      body: { title: 'Мой канвас' },
    });
    expect(space).toEqual({ id: 'space-1' });
  });

  it('читает граф вместе с его версией', async () => {
    const { api, calls } = setup({ data: graph, etag: '"v1"' });

    const snapshot = await api.getGraph('space-1');

    expect(calls[0]).toMatchObject({ method: 'GET', path: '/api/spaces/space-1/graph' });
    expect(snapshot).toEqual({ graph, etag: '"v1"' });
  });

  it('сохраняет граф с условием If-Match и отдаёт новую версию', async () => {
    const { api, calls } = setup({ data: graph, etag: '"v2"' });

    const snapshot = await api.saveGraph({ spaceId: 'space-1', graph, etag: '"v1"' });

    expect(calls[0]).toMatchObject({
      method: 'PUT',
      path: '/api/spaces/space-1/graph',
      body: graph,
      headers: { 'If-Match': '"v1"' },
    });
    expect(snapshot.etag).toBe('"v2"');
  });

  it('запускает генерацию с ключом идемпотентности и версией графа', async () => {
    const { api, calls } = setup({ status: 202, data: { id: 'gen-1', status: 'processing' } });

    const generation = await api.startGeneration({
      spaceId: 'space-1',
      nodeId: 'node-2',
      graphETag: '"v2"',
      scenario: 'success',
      idempotencyKey: 'key-abc',
    });

    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/spaces/space-1/generations',
      body: { nodeId: 'node-2', graphETag: '"v2"', scenario: 'success' },
      headers: { 'Idempotency-Key': 'key-abc' },
    });
    expect(generation.id).toBe('gen-1');
  });

  it('читает генерацию и список генераций пространства', async () => {
    const { api, calls } = setup({ data: [] });

    await api.listGenerations('space-1');
    await api.getGeneration('space-1', 'gen-1');

    expect(calls.map((call) => call.path)).toEqual([
      '/api/spaces/space-1/generations',
      '/api/spaces/space-1/generations/gen-1',
    ]);
  });

  it('передаёт сигнал отмены во все запросы', async () => {
    const { api, calls } = setup({ data: graph, etag: '"v1"' });
    const signal = new AbortController().signal;

    await api.getGraph('space-1', signal);

    expect(calls[0]?.signal).toBe(signal);
  });

  it('сообщает об ответе без ожидаемого тела', async () => {
    const { api } = setup({ data: null });

    await expect(api.getGraph('space-1')).rejects.toThrow(/ответ/i);
  });
});
