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
});
