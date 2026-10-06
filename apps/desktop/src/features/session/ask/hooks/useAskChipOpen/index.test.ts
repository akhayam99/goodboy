// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { act, renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, ResolveAttempt, SessionId, WorkspaceId } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { selectOpenDrawer } from '../../../../../store/slices/drawer/selectOpenDrawer';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { useAskChipOpen } from '.';

const WORKSPACE = 'ws-harborline' as WorkspaceId;
const SESSION = 'session-ledger-core' as SessionId;
const IMPLEMENTER = 'agent-implementer' as AgentId;
const RESOLVER = 'agent-resolver' as AgentId;
const THREAD = 'gh:PRRT_42';

const attempt: ResolveAttempt = {
  id: 'attempt-resolver',
  sessionId: SESSION,
  agentId: RESOLVER,
  prNumber: 318,
  threadIds: [THREAD],
  provider: 'anthropic',
  model: 'sonnet-5',
  effort: null,
  instructions: null,
  phase: 'finished',
  mountTarget: null,
  startedAt: null,
  endedAt: null,
  error: null,
  createdAt: 1,
  batchId: null,
  copyPath: null,
  launchChoice: null,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE,
    sessions: [aSession({ id: SESSION, workspaceId: WORKSPACE })],
    sessionPhaseRuns: {
      [SESSION]: [
        anAgent({ id: IMPLEMENTER, sessionId: SESSION, name: 'Implementer' }),
        anAgent({ id: RESOLVER, sessionId: SESSION, name: 'resolve: Theo on webhook.ts:88' }),
      ],
    },
    agentKindOverride: { [RESOLVER]: 'resolver' },
    sessionResolveAttempts: { [SESSION]: [attempt] },
  });
  act(() => {
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId: SESSION }) });
    useAppStore.getState().openDrawer({ kind: 'ask', sessionId: SESSION, payload: null });
  });
});

const openChip = (agentId: AgentId): void => {
  const { result } = renderHook(() =>
    useAskChipOpen({ sessionId: SESSION, onOpenInside: () => undefined }),
  );
  act(() => result.current({ key: 'A1', label: 'Agent', target: { kind: 'agent', agentId } }));
};

describe('useAskChipOpen', () => {
  it('moves the page to Branch Comments for a resolver and keeps the answer in the drawer', () => {
    openChip(RESOLVER);

    const state = useAppStore.getState();
    expect(selectOpenDrawer(state)?.kind).toBe('ask');
    expect(state.activeLens[SESSION]).toBe('branch');
    expect(state.branchTab[SESSION]).toBe('comments');
    expect(state.branchThreadId[SESSION]).toBe(THREAD);
  });

  it('opens any other agent on its page with the answer still in the drawer', () => {
    openChip(IMPLEMENTER);

    const state = useAppStore.getState();
    expect(selectOpenDrawer(state)?.kind).toBe('ask');
    expect(state.activeLens[SESSION]).toBe('agents');
  });
});
