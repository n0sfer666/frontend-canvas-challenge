import type { SpaceData } from '@/api/types';

import { isApiError } from '@/api/errors';

export type SpaceStore = {
  read: () => string | null;
  write: (spaceId: string) => void;
  clear: () => void;
};

export type SpaceApi = {
  getSpace: (spaceId: string) => Promise<SpaceData>;
  createSpace: (title: string) => Promise<SpaceData>;
};

export const spaceStorageKey = 'canvas.space';

export const defaultSpaceTitle = 'Рабочее пространство';

export const memoryStore = (initial: string | null = null): SpaceStore => {
  let value = initial;

  return {
    read: () => value,
    write: (spaceId: string) => {
      value = spaceId;
    },
    clear: () => {
      value = null;
    },
  };
};

export const browserStore = (storage: Storage): SpaceStore => ({
  read: () => {
    try {
      return storage.getItem(spaceStorageKey);
    } catch {
      return null;
    }
  },
  write: (spaceId: string) => {
    try {
      storage.setItem(spaceStorageKey, spaceId);
    } catch {
      return;
    }
  },
  clear: () => {
    try {
      storage.removeItem(spaceStorageKey);
    } catch {
      return;
    }
  },
});

const missing = (error: unknown) => isApiError(error) && error.status === 404;

export const resolveSpace = async (api: SpaceApi, store: SpaceStore, title = defaultSpaceTitle): Promise<SpaceData> => {
  const saved = store.read();

  if (saved !== null) {
    try {
      return await api.getSpace(saved);
    } catch (error) {
      if (!missing(error)) throw error;
      store.clear();
    }
  }
  const created = await api.createSpace(title);

  store.write(created.id);

  return created;
};
