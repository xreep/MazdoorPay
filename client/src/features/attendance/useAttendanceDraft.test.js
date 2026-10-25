import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAttendanceDraft } from './useAttendanceDraft.js';

const sheet = {
  workers: [
    { workerId: 'a', status: 'present', isActive: true },
    { workerId: 'b', status: null, isActive: true },
    { workerId: 'c', status: 'absent', isActive: true },
  ],
};

describe('useAttendanceDraft', () => {
  it('setting a worker back to the saved status removes the change', () => {
    const { result } = renderHook(() => useAttendanceDraft(sheet));
    act(() => result.current.set('a', 'absent'));
    expect(result.current.dirtyCount).toBe(1);
    act(() => result.current.set('a', 'present'));
    expect(result.current.dirtyCount).toBe(0);
    expect(result.current.statusOf('a')).toBe('present');
  });

  it('mark all present then undo restores every previous value in one step', () => {
    const { result } = renderHook(() => useAttendanceDraft(sheet));
    act(() => result.current.set('b', 'half-day'));
    act(() => result.current.markAllPresent());
    expect(['a', 'b', 'c'].map(result.current.statusOf)).toEqual(['present', 'present', 'present']);
    expect(result.current.dirtyCount).toBe(2);
    act(() => result.current.undo());
    expect(['a', 'b', 'c'].map(result.current.statusOf)).toEqual(['present', 'half-day', 'absent']);
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.dirtyCount).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it('lists only real changes', () => {
    const { result } = renderHook(() => useAttendanceDraft(sheet));
    act(() => result.current.set('b', 'present'));
    act(() => result.current.set('c', 'absent'));
    expect(result.current.changes).toEqual([{ workerId: 'b', status: 'present' }]);
    act(() => result.current.reset());
    expect(result.current.dirtyCount).toBe(0);
  });
});
