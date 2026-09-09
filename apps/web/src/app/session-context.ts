import type { Session } from './useSession';

import { createContext, useContext } from 'react';

export const SessionContext = createContext<Session | null>(null);

export const useSessionContext = (): Session => {
  const session = useContext(SessionContext);

  if (session === null) throw new Error('Компонент ноды используется вне SessionContext.');

  return session;
};
