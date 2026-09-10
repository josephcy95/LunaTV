import { useQuery } from '@tanstack/react-query';

export const remindersQueryOptions = {
  queryKey: ['reminders'],
  queryFn: async () => ({}) as Record<string, any>,
};

export function useRemindersQuery() {
  return useQuery({ ...remindersQueryOptions, enabled: false });
}

export function useIsRemindedQuery(
  _source: string,
  _id: string,
  _opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['reminders', 'is', _source, _id],
    queryFn: async () => false,
    enabled: false,
  });
}
