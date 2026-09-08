import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { ApiError } from '@/api/errors';
import type { SpaceData } from '@/api/types';
import { memoryStore, resolveSpace } from './space';

type GetMock = Mock<(spaceId: string) => Promise<SpaceData>>;
type CreateMock = Mock<(title: string) => Promise<SpaceData>>;

const space = (id: string): SpaceData => ({
  id,
  title: 'Рабочее пространство',
  createdAt: '2026-01-01T00:00:00.000Z',
  links: {},
});

const api = (getSpace: GetMock, createSpace: CreateMock) => ({ getSpace, createSpace });

describe('resolveSpace', () => {
  it('создаёт пространство и запоминает его идентификатор', async () => {
    const store = memoryStore();
    const getSpace: GetMock = vi.fn();
    const createSpace: CreateMock = vi.fn(() => Promise.resolve(space('new')));

    const opened = await resolveSpace(api(getSpace, createSpace), store);

    expect(opened.id).toBe('new');
    expect(getSpace).not.toHaveBeenCalled();
    expect(store.read()).toBe('new');
  });

  it('после перезагрузки открывает сохранённое пространство', async () => {
    const store = memoryStore('saved');
    const getSpace: GetMock = vi.fn(() => Promise.resolve(space('saved')));
    const createSpace: CreateMock = vi.fn();

    const opened = await resolveSpace(api(getSpace, createSpace), store);

    expect(opened.id).toBe('saved');
    expect(createSpace).not.toHaveBeenCalled();
  });

  it('создаёт новое пространство, если сохранённое исчезло', async () => {
    const store = memoryStore('gone');
    const getSpace: GetMock = vi.fn(() =>
      Promise.reject(new ApiError({ status: 404, code: 'SPACE_NOT_FOUND' })),
    );
    const createSpace: CreateMock = vi.fn(() => Promise.resolve(space('fresh')));

    const opened = await resolveSpace(api(getSpace, createSpace), store);

    expect(opened.id).toBe('fresh');
    expect(store.read()).toBe('fresh');
  });

  it('пробрасывает ошибки, кроме отсутствующего пространства', async () => {
    const store = memoryStore('saved');
    const getSpace: GetMock = vi.fn(() =>
      Promise.reject(new ApiError({ status: 0, code: 'NETWORK_ERROR' })),
    );
    const createSpace: CreateMock = vi.fn();

    await expect(resolveSpace(api(getSpace, createSpace), store)).rejects.toBeInstanceOf(ApiError);
    expect(createSpace).not.toHaveBeenCalled();
    expect(store.read()).toBe('saved');
  });
});

describe('memoryStore', () => {
  it('переживает запись и очистку', () => {
    const store = memoryStore();
    store.write('id');
    expect(store.read()).toBe('id');
    store.clear();
    expect(store.read()).toBeNull();
  });
});
