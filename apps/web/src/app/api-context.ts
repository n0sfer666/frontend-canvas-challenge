import { createContext, useContext } from 'react';
import type { Api } from '@/api/endpoints';

export const ApiContext = createContext<Api | null>(null);

export const useApi = (): Api => {
  const api = useContext(ApiContext);
  if (api === null) throw new Error('Компонент используется вне ApiContext.');
  return api;
};
