import { useMutation } from '@tanstack/react-query';

export function useToggleReminderMutation() {
  return useMutation({
    mutationFn: async (_payload?: any) => undefined,
  });
}

export function useClearRemindersMutation() {
  return useMutation({
    mutationFn: async (_payload?: any) => undefined,
  });
}
