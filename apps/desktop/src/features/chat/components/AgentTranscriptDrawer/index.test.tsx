// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../ChatView', () => ({
  ChatView: ({ agentId, hasComposer }: { agentId?: string; hasComposer?: boolean }) => (
    <div data-testid="drawer-transcript" data-agent={agentId} data-composer={String(hasComposer)} />
  ),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Agent, AgentId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SESSION, SESSION_ID } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { AgentTranscriptDrawer } from '.';

type StoreState = ReturnType<StoryStore['getState']>;

const RESOLVER = 'agent-fix-drawer' as AgentId;
const PLANNER = 'agent-planner-drawer' as AgentId;

const agentOf = (id: AgentId, overrides: Partial<Agent>): Agent => ({
  id,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Planner',
  kind: 'planner',
  status: 'completed',
  ...overrides,
});

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    selectedAgentId: { [SESSION_ID]: null },
    sessionPhaseRuns: {
      [SESSION_ID]: [
        agentOf(RESOLVER, { name: 'resolve: retry backoff', kind: 'resolver' }),
        agentOf(PLANNER, {}),
      ],
    },
  });
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  restore = {};
});

const stub = (actions: Partial<StoreState>): void => {
  const state = useAppStore.getState();
  restore = {
    ...Object.fromEntries(Object.keys(actions).map((key) => [key, state[key as keyof StoreState]])),
    ...restore,
  };
  useAppStore.setState(actions);
};

describe('AgentTranscriptDrawer', () => {
  it('names a fix run as such and shows its transcript without the page composer', () => {
    render(
      <AgentTranscriptDrawer sessionId={SESSION_ID} agentId={RESOLVER} onClose={() => undefined} />,
    );

    expect(screen.getByRole('heading', { name: 'Fix run' })).toBeDefined();
    const transcript = screen.getByTestId('drawer-transcript');
    expect(transcript.getAttribute('data-agent')).toBe(RESOLVER);
    expect(transcript.getAttribute('data-composer')).toBe('false');
  });

  it('puts the lead above the transcript', () => {
    render(
      <AgentTranscriptDrawer
        sessionId={SESSION_ID}
        agentId={RESOLVER}
        lead={<p>Fix run summary</p>}
        onClose={() => undefined}
      />,
    );

    const lead = screen.getByText('Fix run summary');
    const transcript = screen.getByTestId('drawer-transcript');
    expect(lead.compareDocumentPosition(transcript) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('opens with the quoted draft in its reply field, focused, and sends it to that agent', async () => {
    const sendTurn = vi.fn<StoreState['sendTurn']>(async () => ({ blockedOverBudget: false }));
    stub({ sendTurn });
    useAppStore.getState().setAgentDraft(PLANNER, 'About `src/retry.ts:12`');

    render(
      <AgentTranscriptDrawer sessionId={SESSION_ID} agentId={PLANNER} onClose={() => undefined} />,
    );

    const field = screen.getByRole('textbox', { name: 'Message to Planner' });
    expect((field as HTMLTextAreaElement).value).toBe('About `src/retry.ts:12`');
    await waitFor(() => expect(document.activeElement).toBe(field));

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(sendTurn).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        agentId: PLANNER,
        content: 'About `src/retry.ts:12`',
      }),
    );
    await waitFor(() => expect(useAppStore.getState().agentDraft[PLANNER] ?? '').toBe(''));
    expect(useAppStore.getState().selectedAgentId[SESSION_ID]).toBeNull();
  });

  it('says so when the agent is gone', () => {
    render(
      <AgentTranscriptDrawer
        sessionId={SESSION_ID}
        agentId={'agent-gone' as AgentId}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText('This agent is no longer in the session.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });
});
