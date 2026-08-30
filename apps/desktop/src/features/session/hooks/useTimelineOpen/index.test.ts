// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, SessionEventId, SessionId } from '@goodboy/types';
import type { TimelineEventEntry } from '../../timeline/buildTimelineGroups';

const state = vi.hoisted(() => ({
  setActiveLens: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: { getState: () => state },
}));

import { useTimelineOpen } from '.';

const typedString = <Value extends string>({ value }: { readonly value: string }): Value =>
  JSON.parse(JSON.stringify(value));

afterEach(cleanup);

describe('useTimelineOpen', () => {
  it('has no open target for a detached project event', () => {
    const sessionId = typedString<SessionId>({ value: 'session-1' });
    const entry: TimelineEventEntry = {
      kind: 'event',
      id: 'event-1',
      at: '2026-08-30T10:00:00Z',
      event: {
        id: typedString<SessionEventId>({ value: 'event-1' }),
        sessionId,
        kind: 'project_detached',
        payload: { projectName: 'api' },
        createdAt: typedString<IsoDateTime>({ value: '2026-08-30T10:00:00Z' }),
      },
    };
    const { result } = renderHook(() => useTimelineOpen({ sessionId }));

    expect(result.current({ entry })).toBeNull();
  });
});
