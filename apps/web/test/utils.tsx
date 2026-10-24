/** Pembungkus provider untuk uji komponen (React Query + Toast + Confirm + Router + Auth). */
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/lib/auth';
import { ConfirmProvider } from '../src/lib/confirm';
import { ToastProvider } from '../src/components/Toast';
import type { UserDto } from '../src/lib/dto';
import { qk } from '../src/lib/keys';
import { makeUser } from './factories';

export function createTestQueryClient(me?: UserDto | null): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  // `AuthProvider` merender splash selama `/auth/me` masih jalan; isi cache lebih dulu
  // supaya uji komponen tidak perlu menunggu boot sesi.
  if (me !== undefined && me !== null) queryClient.setQueryData(qk.me, me);
  return queryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', user: sessionUser = makeUser() }: { route?: string; user?: UserDto | null } = {},
) {
  const queryClient = createTestQueryClient(sessionUser);
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={[route]}>
            <AuthProvider>{ui}</AuthProvider>
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, user, queryClient };
}
