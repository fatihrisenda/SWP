/** QueryClient + kunci default (Issue 037 langkah 3). */
import { QueryClient } from '@tanstack/react-query';
import { isNetworkError } from './api';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error) => isNetworkError(error) && failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
}
