import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionExternalTask, SessionId } from '@goodboy/types';

vi.mock('../../../../store', async () => {
  const zustand = await import('zustand');
  return { useAppStore: zustand.create(() => ({ sessionExternalTasks: {} })) };
});

import { useAppStore } from '../../../../store';
import { collectLinkedExternalIds, linkedTaskKey, useLinkedExternalIds } from './index';

const task = (provider: SessionExternalTask['provider'], externalId: string) =>
  ({ provider, externalId }) as SessionExternalTask;

const session = (id: string) => ({ id: id as SessionId }) as Session;
const SESSION_A = 'session-a' as SessionId;
const SESSION_B = 'session-b' as SessionId;

afterEach(() => {
  cleanup();
  useAppStore.setState({ sessionExternalTasks: {} });
});

describe('collectLinkedExternalIds', () => {
  it('keys each linked task by provider and keeps the first session that links it', () => {
    const linked = collectLinkedExternalIds({
      sessionExternalTasks: {
        'session-a': [task('sentry', 'issue-1'), task('linear', 'lin-1')],
        'session-b': [task('sentry', 'issue-1')],
      },
      providers: ['sentry'],
    });
    expect([...linked]).toEqual([
      [linkedTaskKey({ provider: 'sentry', externalId: 'issue-1' }), 'session-a'],
    ]);
  });

  it('reads only the sessions it is given, in their order', () => {
    const linked = collectLinkedExternalIds({
      sessionExternalTasks: {
        'session-a': [task('gitlab', '7')],
        'session-b': [task('gitlab', '7')],
        'session-c': [task('gitlab', '9')],
      },
      providers: ['gitlab'],
      sessions: [session('session-b'), session('session-a')],
    });
    expect(linked.get('gitlab:7')).toBe('session-b');
    expect(linked.has('gitlab:9')).toBe(false);
  });
});

describe('useLinkedExternalIds', () => {
  it('keeps one map while unrelated links change', () => {
    useAppStore.setState({ sessionExternalTasks: { [SESSION_A]: [task('github', '42')] } });
    const counter = { renders: 0 };
    const { result } = renderHook(() => {
      counter.renders += 1;
      return useLinkedExternalIds({ providers: ['github'] });
    });
    const first = result.current;
    const before = counter.renders;

    act(() =>
      useAppStore.setState((state) => ({
        sessionExternalTasks: {
          ...state.sessionExternalTasks,
          [SESSION_B]: [task('jira', 'ENG-1')],
        },
      })),
    );
    expect(counter.renders).toBe(before);
    expect(result.current).toBe(first);

    act(() =>
      useAppStore.setState((state) => ({
        sessionExternalTasks: {
          ...state.sessionExternalTasks,
          [SESSION_B]: [task('github', '43')],
        },
      })),
    );
    expect(result.current.get('github:43')).toBe('session-b');
  });
});
