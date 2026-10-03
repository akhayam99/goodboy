// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';
import { useBoardSelection } from './index';

const sid = (value: string) => value as unknown as SessionId;
const session = (id: string) => ({ id, goal: id }) as unknown as Session;

const ACTIVE = [session('a'), session('b'), session('c')];
const ARCHIVED = [session('x'), session('y')];

const setup = () =>
  renderHook(() => useBoardSelection({ activeSessions: ACTIVE, archivedSessions: ARCHIVED }));

describe('useBoardSelection', () => {
  it('reports the active scope and the sessions behind the selected ids', () => {
    const { result } = setup();

    act(() => result.current.active.toggle(sid('a')));
    act(() => result.current.active.toggle(sid('c')));

    expect(result.current.scope).toBe('active');
    expect(result.current.selectedSessions.map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('drops the active selection as soon as an archived card is picked', () => {
    const { result } = setup();

    act(() => result.current.active.toggle(sid('a')));
    act(() => result.current.archived.toggle(sid('x')));

    expect(result.current.scope).toBe('archived');
    expect(result.current.active.selected).toEqual([]);
    expect(result.current.selectedSessions.map((s) => s.id)).toEqual(['x']);
  });

  it('drops the archived selection as soon as an active card is picked', () => {
    const { result } = setup();

    act(() => result.current.archived.selectAll());
    act(() => result.current.active.selectIds([sid('b')], 'replace'));

    expect(result.current.scope).toBe('active');
    expect(result.current.archived.selected).toEqual([]);
    expect(result.current.selectedSessions.map((s) => s.id)).toEqual(['b']);
  });

  it('clears both halves at once', () => {
    const { result } = setup();

    act(() => result.current.active.toggle(sid('a')));
    act(() => result.current.clearAll());

    expect(result.current.selectedSessions).toEqual([]);
    expect(result.current.scope).toBe('active');
  });

  it('keeps the callbacks the cards hold the same while the selection changes', () => {
    const { result } = setup();
    const before = {
      onItemClick: result.current.onItemClick,
      onToggle: result.current.onToggle,
      getSelectedIds: result.current.getSelectedIds,
    };

    act(() => result.current.onToggle(sid('a')));
    act(() => result.current.onToggle(sid('b')));

    expect(result.current.onItemClick).toBe(before.onItemClick);
    expect(result.current.onToggle).toBe(before.onToggle);
    expect(result.current.getSelectedIds).toBe(before.getSelectedIds);
    expect(result.current.getSelectedIds()).toEqual(['a', 'b']);
  });

  it('toggles a card, and extends to a range on shift', () => {
    const { result } = setup();

    act(() => result.current.onToggle(sid('a')));
    act(() => result.current.onToggle(sid('c'), { shiftKey: true }));

    expect(result.current.selectedIds).toEqual(['a', 'b', 'c']);
    act(() => result.current.onToggle(sid('b')));
    expect(result.current.isSelected(sid('b'))).toBe(false);
  });

  it('routes an archived card to the archived half and counts its lane for Select all', () => {
    const { result } = setup();

    act(() => result.current.onToggle(sid('x')));

    expect(result.current.scope).toBe('archived');
    expect(result.current.total).toBe(2);
    act(() => result.current.selectAll());
    expect(result.current.selectedIds).toEqual(['x', 'y']);
  });

  it('selects the active lane when nothing is picked yet', () => {
    const { result } = setup();

    expect(result.current.total).toBe(3);
    act(() => result.current.selectAll());

    expect(result.current.selectedIds).toEqual(['a', 'b', 'c']);
  });
});
