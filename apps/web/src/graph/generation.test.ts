import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { StartGenerationInput } from '@/api/endpoints';
import { ApiError } from '@/api/errors';
import type { GenerationData } from '@/api/types';
import { createGenerations } from './generation';
import type { FlushResult } from './sync';

type StartMock = Mock<(input: StartGenerationInput) => Promise<GenerationData>>;
type ReadMock = Mock<(spaceId: string, generationId: string) => Promise<GenerationData>>;
type FlushMock = Mock<() => Promise<FlushResult>>;

const generation = (patch: Partial<GenerationData> = {}): GenerationData => ({
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

const setup = (options: { start?: StartMock; read?: ReadMock; flush?: FlushMock } = {}) => {
  const start: StartMock = options.start ?? vi.fn(() => Promise.resolve(generation()));
  const read: ReadMock = options.read ?? vi.fn(() => Promise.resolve(generation()));
  const flush: FlushMock =
    options.flush ?? vi.fn(() => Promise.resolve({ etag: '"v1"', graph: null }));
  let counter = 0;
  const runs = createGenerations({
    spaceId: 'space-1',
    pollIntervalMs: 500,
    flush,
    newKey: () => `key-${String(++counter)}`,
    api: { startGeneration: start, getGeneration: read },
    onChange: () => undefined,
  });
  return { runs, start, read, flush };
};

describe('createGenerations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('сначала сохраняет граф, затем запускает генерацию его версией', async () => {
    const { runs, start, flush } = setup();

    await runs.start('g1', 'success');

    expect(flush).toHaveBeenCalledOnce();
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      spaceId: 'space-1',
      nodeId: 'g1',
      graphETag: '"v1"',
      scenario: 'success',
      idempotencyKey: 'key-1',
    });
  });

  it('не запускает генерацию, если сохранение не удалось', async () => {
    const flush: FlushMock = vi.fn(() =>
      Promise.reject(new ApiError({ status: 412, code: 'GRAPH_VERSION_CONFLICT' })),
    );
    const { runs, start } = setup({ flush });

    await runs.start('g1', 'success');

    expect(start).not.toHaveBeenCalled();
    expect(runs.runFor('g1')).toMatchObject({ status: 'error' });
  });

  it('опрашивает статус до успеха и показывает картинку в ноде результата', async () => {
    const read: ReadMock = vi.fn();
    read
      .mockResolvedValueOnce(generation())
      .mockResolvedValue(generation({ status: 'succeeded', imageUrl: '/assets/demo.svg' }));
    const { runs } = setup({ read });

    await runs.start('g1', 'success');
    await vi.advanceTimersByTimeAsync(1500);

    expect(runs.runFor('g1')).toMatchObject({ status: 'succeeded' });
    expect(runs.resultFor('r1')?.imageUrl).toBe('/assets/demo.svg');
  });

  it('прекращает опрос после итогового статуса', async () => {
    const read: ReadMock = vi.fn();
    read.mockResolvedValue(generation({ status: 'failed', failureCode: 'SIMULATED_FAILURE' }));
    const { runs } = setup({ read });

    await runs.start('g1', 'failure');
    await vi.advanceTimersByTimeAsync(3000);
    const calls = read.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3000);

    expect(read.mock.calls.length).toBe(calls);
    expect(runs.runFor('g1')).toMatchObject({ status: 'failed', failureCode: 'SIMULATED_FAILURE' });
  });

  it('повтор после потери ответа сохраняет прежний ключ, новый запуск получает новый', async () => {
    const start: StartMock = vi.fn();
    start
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK_ERROR' }))
      .mockResolvedValue(generation({ status: 'succeeded', imageUrl: '/assets/demo.svg' }));
    const { runs } = setup({ start });

    await runs.start('g1', 'success');
    expect(runs.runFor('g1')).toMatchObject({ status: 'error' });

    await runs.start('g1', 'success');
    expect(start.mock.calls[1]?.[0]).toMatchObject({ idempotencyKey: 'key-1' });

    await runs.start('g1', 'success');
    expect(start.mock.calls[2]?.[0]).toMatchObject({ idempotencyKey: 'key-2' });
  });

  it('не подставляет результат прежнего запуска поверх более нового', async () => {
    const read: ReadMock = vi.fn();
    read.mockResolvedValue(generation());
    const start: StartMock = vi.fn();
    start
      .mockResolvedValueOnce(generation({ id: 'gen-old' }))
      .mockResolvedValueOnce(generation({ id: 'gen-new' }));
    const { runs } = setup({ start, read });

    await runs.start('g1', 'success');
    await runs.start('g1', 'success');
    read.mockResolvedValue(
      generation({ id: 'gen-old', status: 'succeeded', imageUrl: '/assets/old.svg' }),
    );
    await vi.advanceTimersByTimeAsync(1500);

    expect(runs.resultFor('r1')?.imageUrl).not.toBe('/assets/old.svg');
    expect(runs.runFor('g1')).toMatchObject({ generationId: 'gen-new', status: 'processing' });
  });

  it('останавливает опрос при закрытии пространства', async () => {
    const { runs, read } = setup();

    await runs.start('g1', 'success');
    runs.dispose();
    await vi.advanceTimersByTimeAsync(3000);

    expect(read).not.toHaveBeenCalled();
  });

  it('восстанавливает незавершённые генерации из списка сервера', async () => {
    const read: ReadMock = vi.fn((_spaceId, generationId) =>
      Promise.resolve(
        generation({ id: generationId, status: 'succeeded', imageUrl: '/assets/demo.svg' }),
      ),
    );
    const { runs } = setup({ read });

    runs.adopt([
      generation({
        id: 'gen-done',
        nodeId: 'g2',
        resultNodeId: 'r2',
        status: 'succeeded',
        imageUrl: '/assets/demo.svg',
      }),
      generation({ id: 'gen-live' }),
    ]);

    expect(runs.resultFor('r2')?.imageUrl).toBe('/assets/demo.svg');
    expect(runs.runFor('g1')).toMatchObject({ status: 'processing' });

    await vi.advanceTimersByTimeAsync(1000);

    expect(runs.runFor('g1')).toMatchObject({ status: 'succeeded' });
    expect(read).toHaveBeenCalledWith('space-1', 'gen-live');
  });
});
