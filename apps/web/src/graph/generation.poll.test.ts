import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/errors';
import { generationOf as generation, setupGenerations as setup } from '@/test/generations';
import type { ReadMock, StartMock } from '@/test/generations';

describe('createGenerations: опрос и восстановление', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
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

  it('перестаёт опрашивать сервер после серии неудачных ответов', async () => {
    const read: ReadMock = vi.fn(() =>
      Promise.reject(new ApiError({ status: 0, code: 'NETWORK_ERROR' })),
    );
    const { runs } = setup({ read, maxPollFailures: 3 });

    await runs.start('g1', 'success');
    await vi.advanceTimersByTimeAsync(5000);

    expect(read).toHaveBeenCalledTimes(3);
    expect(runs.runFor('g1')).toMatchObject({ status: 'error' });
  });

  it('не опрашивает повторно, если генерация больше не существует', async () => {
    const read: ReadMock = vi.fn(() =>
      Promise.reject(new ApiError({ status: 404, code: 'GENERATION_NOT_FOUND' })),
    );
    const { runs } = setup({ read });

    await runs.start('g1', 'success');
    await vi.advanceTimersByTimeAsync(5000);

    expect(read).toHaveBeenCalledOnce();
    expect(runs.runFor('g1')).toMatchObject({ status: 'error' });
  });

  it('из нескольких генераций одного генератора оставляет последнюю', () => {
    const { runs } = setup();

    runs.adopt([
      generation({ id: 'gen-new', createdAt: '2026-01-02T00:00:00.000Z', status: 'processing' }),
      generation({
        id: 'gen-old',
        createdAt: '2026-01-01T00:00:00.000Z',
        status: 'succeeded',
        imageUrl: '/assets/old.svg',
      }),
    ]);

    expect(runs.runFor('g1')).toMatchObject({ generationId: 'gen-new', status: 'processing' });
    expect(runs.resultFor('r1')?.imageUrl).toBeNull();
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
