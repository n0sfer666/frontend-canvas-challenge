import type { StartMock, FlushMock } from '@/test/generations';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/errors';
import { generationOf as generation, setupGenerations as setup } from '@/test/generations';

describe('createGenerations: запуск', () => {
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
    const flush: FlushMock = vi.fn(() => Promise.reject(new ApiError({ status: 412, code: 'GRAPH_VERSION_CONFLICT' })));
    const { runs, start } = setup({ flush });

    await runs.start('g1', 'success');

    expect(start).not.toHaveBeenCalled();
    expect(runs.runFor('g1')).toMatchObject({ status: 'error' });
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

  it('повтор после потери ответа отправляет прежний сценарий, а не выбранный заново', async () => {
    const start: StartMock = vi.fn();

    start
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK_ERROR' }))
      .mockResolvedValue(generation({ scenario: 'failure' }));
    const { runs } = setup({ start });

    await runs.start('g1', 'failure');
    await runs.start('g1', 'success');

    expect(start.mock.calls[1]?.[0]).toMatchObject({
      idempotencyKey: 'key-1',
      scenario: 'failure',
      graphETag: '"v1"',
    });
  });
});
