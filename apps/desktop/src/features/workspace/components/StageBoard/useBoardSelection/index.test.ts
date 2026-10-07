// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';
import { useBoardSelection } from './index';

const sid = (value: string) => value as unknown as SessionId;
const session = (id: string) => ({ id, goal: id }) as unknown as Session;

const BOARD = [
  session('building-1'),
  session('running-1'),
  session('attention-1'),
  session('review-1'),
  session('done-1'),
  session('done-2'),
  session('done-3'),
  session('archived-1'),
  session('archived-2'),
];

const setup = (sessions: ReadonlyArray<Session> = BOARD) =>
  renderHook(() => useBoardSelection({ sessions }));

describe('useBoardSelection', () => {
  it('reports the sessions behind the selected ids, in lane order', () => {
    const { result } = setup();

    act(() => result.current.onToggle(sid('review-1')));
    act(() => result.current.onToggle(sid('building-1')));

    expect(result.current.selectedIds).toEqual(['building-1', 'review-1']);
    expect(result.current.selectedSessions.map((s) => s.id)).toEqual(['building-1', 'review-1']);
  });

  it('holds an active card and an archived card in one selection', () => {
    const { result } = setup();

    act(() => result.current.onToggle(sid('done-1')));
    act(() => result.current.onToggle(sid('archived-1')));

    expect(result.current.selectedIds).toEqual(['done-1', 'archived-1']);
    expect(result.current.isSelected(sid('archived-1'))).toBe(true);
  });

  it('extends a Shift range from the Done half into the Archived half', () => {
    const { result } = setup();

    act(() => result.current.onToggle(sid('done-2')));
    act(() => result.current.onToggle(sid('archived-2'), { shiftKey: true }));

    expect(result.current.selectedIds).toEqual(['done-2', 'done-3', 'archived-1', 'archived-2']);
  });

  it('extends a Shift range across the lanes before Done in lane order', () => {
    const { result } = setup();

    act(() => result.current.onToggle(sid('running-1')));
    act(() => result.current.onToggle(sid('done-1'), { shiftKey: true }));

    expect(result.current.selectedIds).toEqual(['running-1', 'attention-1', 'review-1', 'done-1']);
  });

  it('selects every card of every lane with Select all, Archived included', () => {
    const { result } = setup();

    expect(result.current.total).toBe(BOARD.length);
    act(() => result.current.selectAll());

    expect(result.current.selectedIds).toEqual(BOARD.map((s) => s.id));
  });

  it('selects sixty Done cards and every other card with Select all', () => {
    const done = Array.from({ length: 60 }, (_, index) => session(`done-${index}`));
    const board = [session('building-1'), session('review-1'), ...done, session('archived-1')];
    const { result } = setup(board);

    act(() => result.current.selectAll());

    expect(result.current.selectedIds).toHaveLength(63);
    expect(result.current.selectedIds.filter((id) => id.startsWith('done-'))).toHaveLength(60);
    expect(result.current.total).toBe(63);
  });

  it('replaces and adds with the ids a lasso crosses', () => {
    const { result } = setup();

    act(() => result.current.selectIds([sid('done-1'), sid('archived-1')], 'replace'));
    expect(result.current.selectedIds).toEqual(['done-1', 'archived-1']);

    act(() => result.current.selectIds([sid('building-1')], 'add'));
    expect(result.current.selectedIds).toEqual(['building-1', 'done-1', 'archived-1']);
  });

  it('clears the whole selection at once', () => {
    const { result } = setup();

    act(() => result.current.selectAll());
    act(() => result.current.clearAll());

    expect(result.current.selectedSessions).toEqual([]);
  });

  it('keeps the callbacks the cards hold the same while the selection changes', () => {
    const { result } = setup();
    const before = {
      onItemClick: result.current.onItemClick,
      onToggle: result.current.onToggle,
      getSelectedIds: result.current.getSelectedIds,
    };

    act(() => result.current.onToggle(sid('building-1')));
    act(() => result.current.onToggle(sid('running-1')));

    expect(result.current.onItemClick).toBe(before.onItemClick);
    expect(result.current.onToggle).toBe(before.onToggle);
    expect(result.current.getSelectedIds).toBe(before.getSelectedIds);
    expect(result.current.getSelectedIds()).toEqual(['building-1', 'running-1']);
  });

  it('toggles a card off and drops a card that left the board', () => {
    const { result, rerender } = renderHook(
      ({ sessions }: { sessions: ReadonlyArray<Session> }) => useBoardSelection({ sessions }),
      { initialProps: { sessions: BOARD } },
    );

    act(() => result.current.onToggle(sid('building-1')));
    act(() => result.current.onToggle(sid('running-1')));
    act(() => result.current.onToggle(sid('building-1')));
    expect(result.current.isSelected(sid('building-1'))).toBe(false);

    rerender({ sessions: BOARD.filter((s) => s.id !== 'running-1') });
    expect(result.current.selectedIds).toEqual([]);
  });
});
