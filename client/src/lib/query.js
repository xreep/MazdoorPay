import { useQuery } from '@tanstack/react-query';

// Every screen reads server data through this rule: figures are shown only when they are current.
// Data cached before this visit and being refreshed, or results for the previous filter, count
// as loading, so a page shows its loading state rather than old figures as if they were current.
// Data fetched moments ago (within the cache's fresh window) shows at once.
export function useCurrentQuery(options) {
  const result = useQuery(options);
  const outdated =
    result.isPlaceholderData ||
    (result.isFetching && !result.isFetchedAfterMount && result.data !== undefined);
  return outdated ? { ...result, data: undefined, isPending: true, isSuccess: false } : result;
}

// After a save: clear (not just mark stale) everything the save may have changed. Open pages
// show their loading state and refetch; pages opened later fetch afresh. Nothing old is left
// to be shown as current.
export const refreshAfterSave = (queryClient, keys) =>
  Promise.all(keys.map((key) => queryClient.resetQueries({ queryKey: [key] })));
