import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import { configFixture, generationFixture, graphFixture, ids, spaceFixture } from '@/test/fixtures';
import { createApi } from './endpoints';
import type { Http, HttpRequest } from './http';

type Result = { status?: number; data?: unknown; etag?: string };

const setup = (result: Result = {}) => {
  const calls: HttpRequest<unknown>[] = [];
  const payload: unknown = result.data;
  const http: Http = (request) => {
    calls.push(request);
    const { schema } = request;
    return Promise.resolve({
      status: result.status ?? 200,
      data: schema !== undefined && Value.Check(schema, payload) ? payload : null,
      etag: result.etag ?? null,
      headers: new Headers(),
    });
  };
  return { api: createApi(http, 'http://api.test'), calls };
};

describe('createApi', () => {
  it('создаёт пространство', async () => {
    const created = spaceFixture();
    const { api, calls } = setup({ status: 201, data: created });

    const space = await api.createSpace('Мой канвас');

    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/spaces',
      body: { title: 'Мой канвас' },
    });
    expect(space).toEqual(created);
  });

  it('читает граф вместе с его версией', async () => {
    const graph = graphFixture();
    const { api, calls } = setup({ data: graph, etag: '"v1"' });

    const snapshot = await api.getGraph('space-1');

    expect(calls[0]).toMatchObject({ method: 'GET', path: '/api/spaces/space-1/graph' });
    expect(snapshot).toEqual({ graph, etag: '"v1"' });
  });

  it('сохраняет граф с условием If-Match и отдаёт новую версию', async () => {
    const graph = graphFixture();
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
    const { api, calls } = setup({ status: 202, data: generationFixture({ status: 'processing' }) });

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
    expect(generation.id).toBe(ids.generation);
  });

  it('читает конфигурацию, список пространств и генераций', async () => {
    const config = setup({ data: configFixture() });
    const spaces = setup({ data: [spaceFixture()] });
    const generations = setup({ data: [generationFixture()] });

    expect((await config.api.getConfig()).maxNodes).toBe(20);
    expect(await spaces.api.listSpaces()).toHaveLength(1);
    expect(await generations.api.listGenerations('space-1')).toHaveLength(1);
    expect(generations.calls[0]?.path).toBe('/api/spaces/space-1/generations');
  });

  it('читает одну генерацию пространства', async () => {
    const { api, calls } = setup({ data: generationFixture() });

    await api.getGeneration('space-1', 'gen-1');

    expect(calls[0]?.path).toBe('/api/spaces/space-1/generations/gen-1');
  });

  it('передаёт сигнал отмены во все запросы', async () => {
    const { api, calls } = setup({ data: graphFixture(), etag: '"v1"' });
    const signal = new AbortController().signal;

    await api.getGraph('space-1', signal);

    expect(calls[0]?.signal).toBe(signal);
  });

  it('строит адрес ресурса от базы API', () => {
    const { api } = setup();

    expect(api.assetUrl('/assets/demo.svg')).toBe('http://api.test/assets/demo.svg');
  });

  it('сообщает об ответе без ожидаемого тела', async () => {
    const { api } = setup({ data: null });

    await expect(api.getGraph('space-1')).rejects.toThrow(/ответ/i);
  });
});
