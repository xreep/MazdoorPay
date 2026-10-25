import { useCallback, useMemo, useState } from 'react';

// Unsaved attendance marks on top of the saved sheet, with a one-step-at-a-time undo.
export function useAttendanceDraft(sheet) {
  const saved = useMemo(
    () => new Map((sheet?.workers ?? []).map((w) => [w.workerId, w.status])),
    [sheet]
  );
  const [draft, setDraft] = useState({});
  const [history, setHistory] = useState([]);

  const statusOf = useCallback(
    (workerId) => (workerId in draft ? draft[workerId] : (saved.get(workerId) ?? null)),
    [draft, saved]
  );

  const apply = useCallback(
    (updates) => {
      setHistory((h) => [...h, draft]);
      const next = { ...draft };
      for (const [workerId, status] of updates) {
        if (saved.get(workerId) === status) delete next[workerId];
        else next[workerId] = status;
      }
      setDraft(next);
    },
    [draft, saved]
  );

  const set = useCallback((workerId, status) => apply([[workerId, status]]), [apply]);

  const markAllPresent = useCallback(() => {
    const updates = (sheet?.workers ?? [])
      .filter((w) => w.isActive && statusOf(w.workerId) !== 'present')
      .map((w) => [w.workerId, 'present']);
    if (updates.length) apply(updates);
  }, [sheet, statusOf, apply]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      setDraft(h.at(-1));
      return h.slice(0, -1);
    });
  }, []);

  // After a save: keep only the changes the server refused, forget the undo trail.
  const retain = useCallback((workerIds) => {
    const keep = new Set(workerIds);
    setDraft((d) => Object.fromEntries(Object.entries(d).filter(([id]) => keep.has(id))));
    setHistory([]);
  }, []);

  const reset = useCallback(() => {
    setDraft({});
    setHistory([]);
  }, []);

  const changes = Object.entries(draft).map(([workerId, status]) => ({ workerId, status }));
  return {
    statusOf,
    set,
    markAllPresent,
    undo,
    canUndo: history.length > 0,
    changes,
    dirtyCount: changes.length,
    retain,
    reset,
  };
}
