// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { brandedId } from '../../../history/testing/brandedId';
import { seedColumn, sessionOf } from '../../testing/sessionColumn';
import { useSessionRowFacts } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('useSessionRowFacts', () => {
  it('gives a row its node, its title and its plain title from one call', () => {
    const session = sessionOf({ goal: 'Fix **webhook** retries' });
    seedColumn({ store: useAppStore, sessions: [session] });

    const { result } = renderHook(() => useSessionRowFacts({ session }));

    expect(result.current.title).toBe('Fix **webhook** retries');
    expect(result.current.plainTitle).toBe('Fix webhook retries');
    expect(result.current.keys).toEqual([]);
  });

  it('names a blank goal the one way every row names it', () => {
    const session = sessionOf({ goal: '   ' });
    seedColumn({ store: useAppStore, sessions: [session] });

    const { result } = renderHook(() => useSessionRowFacts({ session }));

    expect(result.current.title).toBe('Untitled session');
    expect(result.current.plainTitle).toBe('Untitled session');
  });

  it('splits a linked task key off the front of the title', () => {
    const session = sessionOf({ goal: '[NW-142] Retry webhook deliveries' });
    const sessionId = brandedId<SessionId>({ value: session.id });
    seedColumn({ store: useAppStore, sessions: [session] });
    useAppStore.setState({
      sessionExternalTasks: {
        [sessionId]: [
          {
            sessionId,
            provider: 'linear',
            externalId: 'ext-nw-142',
            identifier: 'NW-142',
            title: 'Retry webhook deliveries on a 502',
            url: 'https://linear.app/northwind/issue/NW-142',
            createdAt: brandedId<IsoDateTime>({ value: '2026-10-05T09:00:00.000Z' }),
          },
        ],
      },
    });

    const { result } = renderHook(() => useSessionRowFacts({ session }));

    expect(result.current.keys).toEqual(['NW-142']);
    expect(result.current.title).toBe('Retry webhook deliveries');
  });

  it('draws the archived node for an archived row and the live one otherwise', () => {
    const session = sessionOf({ goal: 'Ledger export speedup' });
    seedColumn({ store: useAppStore, sessions: [session] });

    const live = renderHook(() => useSessionRowFacts({ session }));
    const archived = renderHook(() => useSessionRowFacts({ session, isArchived: true }));

    expect(archived.result.current.node).not.toEqual(live.result.current.node);
  });

  it('leaves the agent being viewed out of the unread label', () => {
    const session = sessionOf({ goal: 'Ledger export speedup' });
    const viewed = anAgent({
      sessionId: session.id,
      name: 'Trace the rounding',
      status: 'completed',
      lastFinishedAt: brandedId<IsoDateTime>({ value: '2026-10-05T10:00:00.000Z' }),
    });
    const other = anAgent({
      sessionId: session.id,
      name: 'Review the ledger',
      status: 'completed',
      lastFinishedAt: brandedId<IsoDateTime>({ value: '2026-10-05T09:00:00.000Z' }),
    });
    seedColumn({ store: useAppStore, sessions: [session] });
    useAppStore.setState({
      sessionPhaseRuns: { [session.id]: [viewed, other] },
      currentSessionId: session.id,
      selectedAgentId: { [session.id]: viewed.id },
    });

    const { result } = renderHook(() => useSessionRowFacts({ session }));

    expect(result.current.unreadLabel).toBe('1 new: Review the ledger');
  });
});
