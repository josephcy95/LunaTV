import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

import QueryProvider from './QueryProvider';

jest.mock('@/lib/db.client', () => ({
  subscribeToDataUpdates: (
    event: string,
    callback: (data: unknown) => void,
  ) => {
    const listener = (e: Event) => callback((e as CustomEvent).detail);
    window.addEventListener(event, listener);
    return () => window.removeEventListener(event, listener);
  },
}));

function Status({ type }: { type: 'favorites' | 'reminders' }) {
  const { data } = useQuery({
    queryKey: [type],
    queryFn: async () => ({}),
    enabled: false,
  });
  return <output data-testid={type}>{JSON.stringify(data)}</output>;
}

describe('QueryProvider cache update bridge', () => {
  test('applies update event payloads directly to shared collection caches', async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <QueryProvider>
          <Status type='favorites' />
          <Status type='reminders' />
        </QueryProvider>
      </QueryClientProvider>,
    );

    window.dispatchEvent(
      new CustomEvent('favoritesUpdated', { detail: { 'source+1': {} } }),
    );
    window.dispatchEvent(
      new CustomEvent('remindersUpdated', { detail: { 'source+2': {} } }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('favorites')).toHaveTextContent('source+1');
      expect(screen.getByTestId('reminders')).toHaveTextContent('source+2');
    });
  });
});
