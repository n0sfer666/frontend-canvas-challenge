import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { createApi } from '@/api/endpoints';
import { createHttp } from '@/api/http';
import { ApiContext } from './api-context';

const configured: unknown = import.meta.env.VITE_API_URL;
const baseUrl = typeof configured === 'string' ? configured : '';

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 } },
      }),
  );
  const [api] = useState(() => createApi(createHttp({ baseUrl })));

  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  );
};
