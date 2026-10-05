// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useDraftRouting } from './index';

const SESSION_ID = 'session-draft' as SessionId;
const OTHER_SESSION_ID = 'session-other' as SessionId;

beforeEach(() => {
  useAppStore.setState({ resolveQueueView: {} });
});

afterEach(() => {
  cleanup();
});

describe('useDraftRouting', () => {
  it('starts on the resolver role default and says so', () => {
    const { result } = renderHook(() => useDraftRouting({ sessionId: SESSION_ID }));

    expect(result.current.source).toBe('role-default');
    expect(result.current.isOverridden).toBe(false);
    expect(result.current.routing).toEqual(result.current.suggested);
  });

  it('holds a model picked in the panel for the session and says so', () => {
    const { result } = renderHook(() => useDraftRouting({ sessionId: SESSION_ID }));

    act(() => {
      result.current.setModel('claude-opus-5');
    });

    expect(result.current.source).toBe('session-pick');
    expect(result.current.isOverridden).toBe(true);
    expect(result.current.routing.model).toBe('claude-opus-5');
    expect(result.current.suggested.model).not.toBe('claude-opus-5');
    expect(useAppStore.getState().resolveQueueView[SESSION_ID]?.lastRouting?.model).toBe(
      'claude-opus-5',
    );
  });

  it('keeps the pick inside its session', () => {
    const first = renderHook(() => useDraftRouting({ sessionId: SESSION_ID }));
    const other = renderHook(() => useDraftRouting({ sessionId: OTHER_SESSION_ID }));

    act(() => {
      first.result.current.setModel('claude-opus-5');
    });

    expect(first.result.current.source).toBe('session-pick');
    expect(other.result.current.source).toBe('role-default');
    expect(other.result.current.routing).toEqual(other.result.current.suggested);
  });

  it('goes back to the role default when the pick is reset', () => {
    const { result } = renderHook(() => useDraftRouting({ sessionId: SESSION_ID }));

    act(() => {
      result.current.setModel('claude-opus-5');
    });
    act(() => {
      result.current.save(null);
    });

    expect(result.current.source).toBe('role-default');
    expect(result.current.routing).toEqual(result.current.suggested);
  });
});
