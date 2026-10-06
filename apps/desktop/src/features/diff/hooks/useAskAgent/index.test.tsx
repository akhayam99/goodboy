// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { useAskAgent } from '.';

type StoreState = ReturnType<StoryStore['getState']>;

const SESSION_ID = 'session-payments-api' as SessionId;
const IMPLEMENTER = 'agent-implementer' as AgentId;

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessionPhaseRuns: {
      [SESSION_ID]: [anAgent({ id: IMPLEMENTER, sessionId: SESSION_ID, name: 'Implementer' })],
    },
    selectedAgentId: { [SESSION_ID]: null },
  });
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  restore = {};
});

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe('useAskAgent', () => {
  it('opens the agent conversation in the drawer with the quote, and the diff stays', () => {
    const navigate = vi.fn<StoreState['navigate']>();
    restore = { navigate: useAppStore.getState().navigate };
    useAppStore.setState({ navigate });
    const { result } = renderHook(() => useAskAgent({ sessionId: SESSION_ID }), { wrapper });

    result.current({
      filePath: 'src/webhooks/retry.ts',
      anchor: { side: 'new', lineNumber: 42 },
      text: 'const delay = base * 2 ** attempt;',
    });

    const state = useAppStore.getState();
    expect(state.drawer).toEqual({
      kind: 'transcript',
      sessionId: SESSION_ID,
      payload: { agentId: IMPLEMENTER },
    });
    expect(state.agentDraft[IMPLEMENTER]).toContain('src/webhooks/retry.ts:42');
    expect(state.agentDraft[IMPLEMENTER]).toContain('> const delay = base * 2 ** attempt;');
    expect(navigate).not.toHaveBeenCalled();
    expect(state.selectedAgentId[SESSION_ID]).toBeNull();
  });
});
