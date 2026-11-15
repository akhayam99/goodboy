// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { brandId, type IsoDateTime, type SessionEventId, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { importStore, resetStoryStore, type StoryStore } from '../../../../store/storyHarness';
import { currentStack } from '../../../../store/slices/navigation/currentStack';
import type { TimelineEventEntry } from '../../timeline/buildTimelineGroups';
import { useTimelineOpen } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const AT = brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' });
let store: StoryStore;
beforeAll(async () => {
  store = await importStore();
});
beforeEach(async () => {
  await resetStoryStore();
  store.setState({ sessions: [aSession({ id: SESSION_ID })], currentSessionId: SESSION_ID });
});
afterEach(cleanup);

describe('Context links from the log', () => {
  it('opens the Decisions section in the Context tab', () => {
    const entry: TimelineEventEntry = {
      kind: 'event',
      id: 'event-harborline',
      at: AT,
      event: {
        id: brandId<SessionEventId>({ value: 'event-harborline' }),
        sessionId: SESSION_ID,
        kind: 'decisions_changed',
        payload: { added: 1 },
        createdAt: AT,
      },
    };
    const { result } = renderHook(() => useTimelineOpen({ sessionId: SESSION_ID }));
    const target = result.current({ entry });
    expect(target?.label).toBe('Open decisions');
    target?.open();
    expect(store.getState().activeLens[SESSION_ID] ?? null).toBe('context');
    expect(store.getState().drawer).toBeNull();
    const stack = currentStack(store.getState());
    expect(stack.entries[stack.index]?.focus.returnRows).toMatchObject({
      'context.section': 'decisions',
    });
  });
});
