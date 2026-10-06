// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, ResolveAttempt } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  THREAD_IDS,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { AgentHeaderStatus } from './AgentHeaderStatus';

let useAppStore: StoryStore;

const RESOLVER = 'agent-status-resolver' as AgentId;

const AGENT: Agent = {
  id: RESOLVER,
  sessionId: SESSION.id,
  ordinal: 1,
  name: 'resolve: comment',
  kind: 'resolver',
  status: 'completed',
};

const ATTEMPT: ResolveAttempt = {
  id: 'attempt-status',
  sessionId: SESSION.id,
  agentId: RESOLVER,
  prNumber: 318,
  threadIds: [EXPANDED_THREAD_ID],
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase: 'finished',
  mountTarget: null,
  startedAt: 1,
  endedAt: 2,
  error: null,
  createdAt: 1,
  batchId: null,
  copyPath: null,
  launchChoice: null,
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveScene({ expandedThreadId: null });
  useAppStore.setState({ sessionResolveAttempts: { [SESSION.id]: [ATTEMPT] } });
});

afterEach(cleanup);

const show = async ({ isResolver }: { readonly isResolver: boolean }): Promise<void> => {
  render(
    <AgentHeaderStatus
      session={SESSION}
      agent={AGENT}
      isResolver={isResolver}
      status="completed"
    />,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

describe('the header status of an agent', () => {
  it('shows the Review state word of a resolver instead of Done', async () => {
    await show({ isResolver: true });

    expect(screen.getByText('Ready')).toBeDefined();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('says Needs you while one comment of the run needs an answer, then Working, then Ready', async () => {
    useAppStore.setState({
      sessionResolveAttempts: {
        [SESSION.id]: [{ ...ATTEMPT, threadIds: [EXPANDED_THREAD_ID, THREAD_IDS.errorShape] }],
      },
    });
    await show({ isResolver: true });

    expect(screen.getByText('Needs you')).toBeDefined();
    expect(screen.queryByText('Ready')).toBeNull();
    cleanup();

    useAppStore.setState({
      sessionResolveAttempts: {
        [SESSION.id]: [{ ...ATTEMPT, threadIds: [EXPANDED_THREAD_ID, THREAD_IDS.idempotency] }],
      },
    });
    await show({ isResolver: true });

    expect(screen.getByText('Working')).toBeDefined();
  });

  it('keeps an accepted comment Ready until it is pushed', async () => {
    const items = useAppStore.getState().sessionResolveQueueItems[SESSION.id] ?? [];
    useAppStore.setState({
      sessionResolveQueueItems: {
        [SESSION.id]: items.map((entry) =>
          entry.thread.threadId === EXPANDED_THREAD_ID
            ? {
                item: { ...entry.item, approvalState: 'accepted', approvedRevision: 1 },
                thread: { ...entry.thread, stage: 'approved', commitShas: ['c81e5aaaaaa'] },
              }
            : entry,
        ),
      },
    });

    await show({ isResolver: true });

    expect(screen.getByText('Ready')).toBeDefined();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('keeps the agent state for an agent that is not a resolver', async () => {
    await show({ isResolver: false });

    expect(screen.getByText('Done')).toBeDefined();
  });

  it('falls back to the agent state when no attempt names the resolver', async () => {
    useAppStore.setState({ sessionResolveAttempts: { [SESSION.id]: [] } });

    await show({ isResolver: true });

    expect(screen.getByText('Done')).toBeDefined();
  });
});
