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
import { act, cleanup, renderHook } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { seedColumn, sessionOf } from '../../../workspace/testing/sessionColumn';
import { useSessionWorkModel } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('useSessionWorkModel per-id selectors', () => {
  it('does not render again when the kind override of an unrelated agent changes', () => {
    const session = sessionOf({ goal: 'Retry webhooks' });
    seedColumn({
      store: useAppStore,
      sessions: [session],
      currentSessionId: session.id as SessionId,
    });
    useAppStore.setState({
      loadSessionEvents: async () => undefined,
      loadSessionArtifacts: async () => undefined,
      loadSessionContextItems: async () => undefined,
      loadSessionAnsweredQuestions: async () => undefined,
      loadSessionDismissedQuestions: async () => undefined,
    });
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useSessionWorkModel({ session });
    });
    const before = renders;

    act(() => {
      useAppStore.setState({
        agentKindOverride: { ['agent-of-another-session' as AgentId]: 'planner' },
      });
    });

    expect(renders).toBe(before);
  });
});
