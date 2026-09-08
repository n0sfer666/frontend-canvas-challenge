import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/errors';
import type { GraphData, GraphSnapshot } from '@/api/types';
import { createGraphSync } from './sync';

const graph = (zoom: number): GraphData => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom },
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const setup = (save: (input: { graph: GraphData; etag: string }) => Promise<GraphSnapshot>) => {
  const states: string[] = [];
  const sync = createGraphSync({
    etag: '"v0"',
    debounceMs: 500,
    save,
    onState: (state) => states.push(state.status),
  });
  return { sync, states };
};

const savedAs = (etag: string) => (input: { graph: GraphData }) =>
  Promise.resolve({ graph: input.graph, etag });

describe('createGraphSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('повторное планирование того же графа не создаёт запрос', async () => {
    const save = vi.fn(savedAs('"v1"'));
    const { sync } = setup(save);

    sync.schedule(graph(1));
    await vi.advanceTimersByTimeAsync(600);
    sync.schedule(graph(1));
    await vi.advanceTimersByTimeAsync(600);

    expect(save).toHaveBeenCalledOnce();
    expect(sync.state().status).toBe('saved');
  });

  it('серия быстрых правок даёт одно сохранение последнего состояния', async () => {
    const save = vi.fn(savedAs('"v1"'));
    const { sync } = setup(save);

    sync.schedule(graph(1));
    await vi.advanceTimersByTimeAsync(200);
    sync.schedule(graph(2));
    await vi.advanceTimersByTimeAsync(200);
    sync.schedule(graph(3));
    await vi.advanceTimersByTimeAsync(600);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toMatchObject({ graph: graph(3), etag: '"v0"' });
    expect(sync.etag()).toBe('"v1"');
  });

  it('одиночная правка тоже сохраняется', async () => {
    const save = vi.fn(savedAs('"v1"'));
    const { sync } = setup(save);

    sync.schedule(graph(1));
    await vi.advanceTimersByTimeAsync(500);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('не отправляет параллельные сохранения и продолжает новой версией', async () => {
    const first = deferred<GraphSnapshot>();
    const save = vi
      .fn<(input: { graph: GraphData; etag: string }) => Promise<GraphSnapshot>>()
      .mockReturnValueOnce(first.promise)
      .mockImplementation(savedAs('"v2"'));
    const { sync } = setup(save);

    sync.schedule(graph(1));
    await vi.advanceTimersByTimeAsync(500);
    sync.schedule(graph(2));
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);

    first.resolve({ graph: graph(1), etag: '"v1"' });
    await vi.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0]).toMatchObject({ graph: graph(2), etag: '"v1"' });
  });

  it('ответ прежнего запроса не отменяет более свежие правки', async () => {
    const first = deferred<GraphSnapshot>();
    const save = vi
      .fn<(input: { graph: GraphData; etag: string }) => Promise<GraphSnapshot>>()
      .mockReturnValueOnce(first.promise)
      .mockImplementation(savedAs('"v2"'));
    const { sync } = setup(save);

    sync.schedule(graph(1));
    await vi.advanceTimersByTimeAsync(500);
    sync.schedule(graph(9));
    first.resolve({ graph: graph(1), etag: '"v1"' });
    await vi.advanceTimersByTimeAsync(500);

    expect(save.mock.calls[1]?.[0].graph).toEqual(graph(9));
    expect(sync.state().status).toBe('saved');
  });

  it('flush отправляет несохранённое немедленно, не дожидаясь таймера', async () => {
    const save = vi.fn(savedAs('"v1"'));
    const { sync } = setup(save);

    sync.schedule(graph(4));
    const snapshot = await sync.flush();

    expect(save).toHaveBeenCalledTimes(1);
    expect(snapshot.etag).toBe('"v1"');
  });

  it('flush без изменений не делает запрос', async () => {
    const save = vi.fn(savedAs('"v1"'));
    const { sync } = setup(save);

    const snapshot = await sync.flush();

    expect(save).not.toHaveBeenCalled();
    expect(snapshot.etag).toBe('"v0"');
  });

  it('flush дожидается идущего сохранения и отправляет остаток', async () => {
    const first = deferred<GraphSnapshot>();
    const save = vi
      .fn<(input: { graph: GraphData; etag: string }) => Promise<GraphSnapshot>>()
      .mockReturnValueOnce(first.promise)
      .mockImplementation(savedAs('"v2"'));
    const { sync } = setup(save);

    sync.schedule(graph(1));
    await vi.advanceTimersByTimeAsync(500);
    sync.schedule(graph(2));
    const pending = sync.flush();
    first.resolve({ graph: graph(1), etag: '"v1"' });

    await expect(pending).resolves.toMatchObject({ etag: '"v2"' });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('конфликт версии не повторяется молча и сохраняет черновик', async () => {
    const conflict = new ApiError({ status: 412, code: 'GRAPH_VERSION_CONFLICT' });
    const save = vi.fn(() => Promise.reject(conflict));
    const { sync } = setup(save);

    sync.schedule(graph(1));
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(2000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(sync.state()).toMatchObject({ status: 'conflict' });
    expect(sync.draft()).toEqual(graph(1));
    expect(sync.etag()).toBe('"v0"');
  });

  it('сетевой сбой оставляет состояние ошибки и допускает повтор', async () => {
    const save = vi
      .fn<(input: { graph: GraphData; etag: string }) => Promise<GraphSnapshot>>()
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK_ERROR' }))
      .mockImplementation(savedAs('"v1"'));
    const { sync } = setup(save);

    sync.schedule(graph(1));
    await vi.advanceTimersByTimeAsync(500);
    expect(sync.state()).toMatchObject({ status: 'error' });

    await sync.flush();

    expect(sync.state().status).toBe('saved');
    expect(sync.etag()).toBe('"v1"');
  });

  it('reset принимает серверный граф и снимает конфликт', async () => {
    const conflict = new ApiError({ status: 412, code: 'GRAPH_VERSION_CONFLICT' });
    const { sync } = setup(vi.fn(() => Promise.reject(conflict)));

    sync.schedule(graph(1));
    await vi.advanceTimersByTimeAsync(500);
    sync.reset({ graph: graph(7), etag: '"v9"' });

    expect(sync.state().status).toBe('saved');
    expect(sync.etag()).toBe('"v9"');
    expect(sync.draft()).toBeNull();
  });

  it('dispose отменяет отложенное сохранение', async () => {
    const save = vi.fn(savedAs('"v1"'));
    const { sync } = setup(save);

    sync.schedule(graph(1));
    sync.dispose();
    await vi.advanceTimersByTimeAsync(1000);

    expect(save).not.toHaveBeenCalled();
  });
});
