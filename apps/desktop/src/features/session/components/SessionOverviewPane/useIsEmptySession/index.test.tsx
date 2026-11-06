// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import {
  brandId,
  type IsoDateTime,
  type Session,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';

let useAppStore: StoryStore;
let useIsEmptySession: typeof import('.').useIsEmptySession;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ useIsEmptySession } = await import('.'));
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const NOW = brandId<IsoDateTime>({ value: '2026-11-06T09:00:00.000Z' });

const session: Session = aSession({
  id: SESSION_ID,
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-1' }),
});

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessions: [session] });
});

afterEach(cleanup);

type EmptyParams = {
  readonly target?: Session;
  readonly hasContent?: boolean;
};

const emptyOf = ({ target = session, hasContent = false }: EmptyParams = {}): boolean =>
  renderHook(() => useIsEmptySession({ session: target, hasContent })).result.current;

describe('useIsEmptySession', () => {
  it('is empty when nothing runs and the page holds nothing', () => {
    expect(emptyOf()).toBe(true);
  });

  it('is not empty once the page holds a row, a card or a branch', () => {
    expect(emptyOf({ hasContent: true })).toBe(false);
  });

  it('is not empty while an agent exists for the session', () => {
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION_ID]: [anAgent({ sessionId: SESSION_ID })] },
    });
    expect(emptyOf()).toBe(false);
  });

  it('is not empty while the agents are still loading', () => {
    useAppStore.setState({
      sessionLoading: {
        [SESSION_ID]: {
          agents: true,
          transcript: false,
          telemetry: false,
          slots: false,
          plans: false,
          summary: false,
        },
      },
    });
    expect(emptyOf()).toBe(false);
  });

  it('is not empty for an archived session', () => {
    expect(emptyOf({ target: { ...session, archivedAt: NOW } })).toBe(false);
  });
});
