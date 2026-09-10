import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

import { useIsFavoritedQuery } from './useFavoritesQuery';

const cases = [
  { collection: 'favorites', useStatus: useIsFavoritedQuery },
  {
    collection: 'reminders',
    useStatus: useIsFavoritedQuery /* removed remind */,
  },
];

// Real QueryClient/observers; only the HTTP boundary is mocked.
describe.each(cases)('$collection card status', ({ collection, useStatus }) => {
  let client: QueryClient;
  const originalFetch = global.fetch;
  let request: jest.Mock;

  function Card({ id, enabled = true }: { id: string; enabled?: boolean }) {
    const { data } = useStatus('source', id, { enabled });
    return <span data-testid={`card-${id}`}>{String(data)}</span>;
  }

  beforeEach(() => {
    client = new QueryClient();
    request = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'source+0': { title: 'Selected' } }),
    });
    global.fetch = request;
  });

  afterEach(() => {
    cleanup();
    client.clear();
    global.fetch = originalFetch;
  });

  test('100 distinct cards share one request and one collection cache entry', async () => {
    const cards = (count: number) => (
      <QueryClientProvider client={client}>
        {Array.from({ length: count }, (_, id) => (
          <Card key={id} id={String(id)} />
        ))}
      </QueryClientProvider>
    );
    const { rerender } = render(cards(100));
    await waitFor(() =>
      expect(screen.getByTestId('card-99')).toHaveTextContent('false'),
    );
    expect(screen.getByTestId('card-0')).toHaveTextContent('true');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(`/api/${collection}`);
    expect(client.getQueryCache().getAll()).toHaveLength(1);

    rerender(cards(125));
    await waitFor(() =>
      expect(screen.getByTestId('card-124')).toHaveTextContent('false'),
    );
    expect(request).toHaveBeenCalledTimes(1);

    // Global invalidation still refreshes the collection once, not per card.
    request.mockResolvedValue({
      ok: true,
      json: async () => ({ 'source+99': {} }),
    });
    await act(async () => {
      await client.invalidateQueries({ queryKey: [collection] });
    });
    await waitFor(() =>
      expect(screen.getByTestId('card-99')).toHaveTextContent('true'),
    );
    expect(screen.getByTestId('card-0')).toHaveTextContent('false');
    expect(request).toHaveBeenCalledTimes(2);
  });

  test('selection follows optimistic cache changes and rollback without refetching', async () => {
    client.setQueryData([collection], {});
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <Card id='a' />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('card-a')).toHaveTextContent('false');
    act(() => {
      client.setQueryData([collection], { 'source+a': {} });
    });
    await waitFor(() =>
      expect(screen.getByTestId('card-a')).toHaveTextContent('true'),
    );
    act(() => {
      client.setQueryData([collection], {});
    });
    await waitFor(() =>
      expect(screen.getByTestId('card-a')).toHaveTextContent('false'),
    );
    act(() => {
      client.setQueryData([collection], { 'source+b': {} });
    });
    rerender(
      <QueryClientProvider client={client}>
        <Card id='b' />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('card-b')).toHaveTextContent('true'),
    );
    expect(request).not.toHaveBeenCalled();
  });

  test('disabled status observers do not initiate requests', () => {
    render(
      <QueryClientProvider client={client}>
        <Card id='a' enabled={false} />
      </QueryClientProvider>,
    );
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByTestId('card-a')).toHaveTextContent('undefined');
  });
});
