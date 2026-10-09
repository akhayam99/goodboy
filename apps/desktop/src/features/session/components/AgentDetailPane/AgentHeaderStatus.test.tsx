// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  ProviderRunId,
  ResolveAttempt,
} from '@goodboy/types';
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
import type { ScribeWork } from '../../../../store/slices/scribe/types';
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

    expect(screen.getByText('To review')).toBeDefined();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('says Question while one comment of the run needs an answer, then Working, then To review', async () => {
    useAppStore.setState({
      sessionResolveAttempts: {
        [SESSION.id]: [{ ...ATTEMPT, threadIds: [EXPANDED_THREAD_ID, THREAD_IDS.errorShape] }],
      },
    });
    await show({ isResolver: true });

    expect(screen.getByText('Question')).toBeDefined();
    expect(screen.queryByText('To review')).toBeNull();
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

  describe('a scribe agent', () => {
    const SCRIBE_ID = 'agent-status-scribe' as AgentId;
    const SCRIBE: Agent = {
      id: SCRIBE_ID,
      sessionId: SESSION.id,
      ordinal: 2,
      name: 'Scribe',
      kind: 'scribe',
      status: 'completed',
    };
    const KEY = 'pr:mount-status-scribe';

    const seedScribe = ({ work }: { readonly work: ScribeWork | null }) =>
      useAppStore.setState({
        transcripts: {
          [SCRIBE_ID]: [
            {
              kind: 'assistant_text',
              runId: 'run-status-scribe' as ProviderRunId,
              delta: '<<pr-title>>\nGuard settlement postings\n<</pr-title>>',
              at: '2026-10-05T10:12:00.000Z' as IsoDateTime,
            },
          ],
        },
        scribeAgents: { [SCRIBE_ID]: KEY },
        scribeWork: work === null ? {} : { [KEY]: work },
      });

    const failedWork: ScribeWork = {
      key: KEY,
      sessionId: SESSION.id,
      mountId: 'mount-status-scribe' as MountId,
      agentId: SCRIBE_ID,
      task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: true, base: null },
      status: 'failed',
      output: null,
      error: "Couldn't push fix/ledger-postings: denied",
      pullRequest: null,
      updatedAt: 0,
    };

    const showScribe = async (): Promise<void> => {
      render(
        <AgentHeaderStatus
          session={SESSION}
          agent={SCRIBE}
          isResolver={false}
          status="completed"
        />,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    };

    it('says Failed, not Done, when its pull request text failed', async () => {
      seedScribe({ work: failedWork });
      await showScribe();

      expect(screen.getByText('Failed')).toBeDefined();
      expect(screen.queryByText('Done')).toBeNull();
    });

    it('keeps Done while the pull request text has not failed', async () => {
      seedScribe({ work: { ...failedWork, status: 'creating', error: null } });
      await showScribe();

      expect(screen.getByText('Done')).toBeDefined();
      expect(screen.queryByText('Failed')).toBeNull();
    });

    it('keeps Done for a scribe with no work recorded', async () => {
      seedScribe({ work: null });
      await showScribe();

      expect(screen.getByText('Done')).toBeDefined();
    });
  });
});
