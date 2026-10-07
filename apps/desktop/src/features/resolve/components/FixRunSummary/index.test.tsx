// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { branchPlace } from '../../../../store/slices/navigation/place';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { resolverBriefOf } from '../../hooks/useResolverBrief';
import { FixRunSummary } from '.';

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

const SINGLE = 'agent-fix-single' as AgentId;
const CHILD = 'agent-fix-child' as AgentId;
const SIBLING = 'agent-fix-sibling' as AgentId;
const GONE = 'agent-fix-gone' as AgentId;
const WORKING = 'agent-fix-working' as AgentId;
const WORKING_RUN = 'run-working' as ProviderRunId;
const AT = '2026-09-04T14:01:00.000Z' as IsoDateTime;
const PROGRESS_LINE = 'Running the typecheck, then renaming the files.';
const ASKING = 'mock-resolve-agent-retry' as AgentId;
const ERROR_SHAPE = 'PRRT_thread_error_shape';
const CHILD_MOUNT = 'mount-fix-child' as MountId;
const TYPO = 'PRRT_thread_typo';
const CONSTANT = 'PRRT_thread_retry_constant';

const attemptOf = ({
  id,
  agentId,
  threadIds,
  batchId,
  mountTarget = null,
  phase = 'finished',
}: {
  readonly id: string;
  readonly agentId: AgentId;
  readonly threadIds: ReadonlyArray<string>;
  readonly batchId: string | null;
  readonly mountTarget?: ResolveAttempt['mountTarget'];
  readonly phase?: ResolveAttempt['phase'];
}): ResolveAttempt => ({
  id,
  sessionId: SESSION.id,
  agentId,
  prNumber: 318,
  threadIds,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase,
  mountTarget,
  startedAt: 1,
  endedAt: phase === 'running' ? null : 2,
  error: null,
  createdAt: 1,
  batchId,
  copyPath: null,
  launchChoice: null,
});

const agentOf = (id: AgentId): Agent => ({
  id,
  sessionId: SESSION.id,
  ordinal: 1,
  name: 'resolve: comment',
  kind: 'resolver',
  status: id === WORKING ? 'running' : 'completed',
  outputSummary: id === WORKING ? undefined : 'Capped the retry loop and added jitter.',
});

const ATTEMPTS = [
  attemptOf({ id: 'a-single', agentId: SINGLE, threadIds: [EXPANDED_THREAD_ID], batchId: null }),
  attemptOf({
    id: 'a-child',
    agentId: CHILD,
    threadIds: [TYPO],
    batchId: 'batch-1',
    mountTarget: { mountId: CHILD_MOUNT, mountRevision: 1, worktreePath: '/repo/child' },
  }),
  attemptOf({ id: 'a-sibling', agentId: SIBLING, threadIds: [CONSTANT], batchId: 'batch-1' }),
  attemptOf({ id: 'a-gone', agentId: GONE, threadIds: ['PRRT_removed'], batchId: null }),
  attemptOf({
    id: 'a-working',
    agentId: WORKING,
    threadIds: [EXPANDED_THREAD_ID, TYPO, CONSTANT, ERROR_SHAPE],
    batchId: null,
    phase: 'running',
  }),
  attemptOf({
    id: 'mock-resolve-attempt-retry',
    agentId: ASKING,
    threadIds: [ERROR_SHAPE],
    batchId: null,
  }),
];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
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

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async ({
  agentId,
  commitShas = null,
}: {
  readonly agentId: AgentId;
  readonly commitShas?: ReadonlyArray<string> | null;
}): Promise<void> => {
  seedResolveScene({ expandedThreadId: null });
  const queue = (useAppStore.getState().sessionResolveQueueItems[SESSION.id] ?? []).map((entry) =>
    commitShas !== null && entry.thread.threadId === EXPANDED_THREAD_ID
      ? { item: entry.item, thread: { ...entry.thread, commitShas } }
      : entry,
  );
  const isWorking = agentId === WORKING;
  useAppStore.setState({
    sessionResolveAttempts: { [SESSION.id]: ATTEMPTS },
    sessionResolveQueueItems: { [SESSION.id]: queue },
    agentTurnState: {
      [agentId]: isWorking
        ? { kind: 'running', runId: WORKING_RUN, startedAt: AT }
        : { kind: 'ended', endedAt: AT },
    },
    transcripts: isWorking
      ? {
          [WORKING]: [{ kind: 'assistant_text', runId: WORKING_RUN, delta: PROGRESS_LINE, at: AT }],
        }
      : {},
  });
  const brief = resolverBriefOf({ attempts: ATTEMPTS, agentId });
  if (brief === null) {
    throw new Error('no brief');
  }
  render(<FixRunSummary session={SESSION} agent={agentOf(agentId)} brief={brief} />);
  await settle();
};

describe('the fix run summary', () => {
  it('says what the resolver did and lists the comment it touched', async () => {
    await mount({ agentId: SINGLE });

    expect(screen.getByRole('heading', { name: 'What it did' })).toBeDefined();
    expect(screen.getByText('Capped the retry loop and added jitter.')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Commits' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Covers 1 comment' })).toBeDefined();
    expect(screen.queryByText(/Fixed together with/)).toBeNull();
  });

  it('has no control that changes the comment, only links out', async () => {
    await mount({ agentId: SINGLE });

    expect(screen.queryByRole('button', { name: /^Accept/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Push/ })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('opens a touched comment on the Comments tab, the transcript drawer kept open', async () => {
    const navigate = vi.fn<StoreState['navigate']>();
    stub({ navigate });
    await mount({ agentId: SINGLE });

    const row = screen
      .getAllByRole('button')
      .find((button) => button.closest('li') !== null && button.closest('ul') !== null);
    expect(row).toBeDefined();
    fireEvent.click(row as HTMLElement);

    expect(navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: SESSION.id, tab: 'comments', threadId: EXPANDED_THREAD_ID }),
      drawer: { kind: 'transcript', sessionId: SESSION.id, payload: { agentId: SINGLE } },
    });
  });

  it('shows no question while nothing waits on you', async () => {
    await mount({ agentId: SINGLE });

    expect(screen.queryByTestId('resolver-question')).toBeNull();
  });

  it('shows the question the run waits on, with its options and the way to answer', async () => {
    const answerQuestions = vi.fn<StoreState['answerQuestions']>(async () => undefined);
    stub({ answerQuestions });
    await mount({ agentId: ASKING });

    const card = within(screen.getByTestId('resolver-question'));
    expect(card.getByRole('heading', { name: 'Question from the fix run' })).toBeDefined();
    expect(card.getAllByRole('radio')).toHaveLength(2);
    expect(card.getByText('Recommended')).toBeDefined();

    fireEvent.click(card.getByRole('button', { name: 'Continue the fix run' }));

    await waitFor(() => expect(answerQuestions).toHaveBeenCalledOnce());
    expect(answerQuestions.mock.calls[0]?.[0]).toMatchObject({
      sessionId: SESSION.id,
      answers: [{ threadId: ERROR_SHAPE }],
    });
  });

  it('sits above the transcript, so it carries no link to it', async () => {
    await mount({ agentId: SINGLE });

    expect(screen.queryByRole('button', { name: 'Open transcript' })).toBeNull();
  });

  it('names the comments fixed together and opens them filtered in Comments', async () => {
    const openReviewTarget = vi.fn<StoreState['openReviewTarget']>(async () => ({
      kind: 'opened',
    }));
    stub({ openReviewTarget });
    await mount({ agentId: CHILD });

    expect(screen.getByText('Fixed together with 1 more comment.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open them in Comments' }));

    expect(openReviewTarget).toHaveBeenCalledWith({
      sessionId: SESSION.id,
      destination: { kind: 'threads', mountId: CHILD_MOUNT, threadIds: [TYPO, CONSTANT] },
    });
  });

  it('says so when the comment is no longer on the branch', async () => {
    await mount({ agentId: GONE });

    expect(screen.getByText('This comment is no longer on the branch.')).toBeDefined();
    expect(screen.getByText('No commits yet')).toBeDefined();
  });

  it('says no commits yet only once the run ended without any', async () => {
    await mount({ agentId: SINGLE });

    expect(screen.getByRole('heading', { name: 'Commits' })).toBeDefined();
    expect(screen.getByText('No commits yet')).toBeDefined();
  });

  it('lists the commits of a finished run instead of saying there are none', async () => {
    await mount({ agentId: SINGLE, commitShas: ['c81e5aa0f3b2d94e7a1c6580de4b9f2a37c1d085'] });

    expect(await screen.findByText('c81e5aa')).toBeDefined();
    expect(screen.queryByText('No commits yet')).toBeNull();
  });

  it('shows a status line, no What it did and no commits block while the run works', async () => {
    await mount({ agentId: WORKING });

    const status = within(screen.getByTestId('fix-run-status'));
    expect(status.getByText(/^Working · /)).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'What it did' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Commits' })).toBeNull();
    expect(screen.queryByText('No commits yet')).toBeNull();
    expect(screen.queryByText(PROGRESS_LINE)).toBeNull();
  });

  it('lists every comment a run covers and selects one on click', async () => {
    const navigate = vi.fn<StoreState['navigate']>();
    stub({ navigate });
    await mount({ agentId: WORKING });

    expect(screen.getByRole('heading', { name: 'Covers 4 comments' })).toBeDefined();
    const rows = within(screen.getByRole('list')).getAllByRole('button');
    expect(rows).toHaveLength(4);
    fireEvent.click(rows[1] as HTMLElement);

    expect(navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: SESSION.id, tab: 'comments', threadId: TYPO }),
      drawer: { kind: 'transcript', sessionId: SESSION.id, payload: { agentId: WORKING } },
    });
  });

  it('shows no status line once the run ended', async () => {
    await mount({ agentId: SINGLE });

    expect(screen.queryByTestId('fix-run-status')).toBeNull();
    expect(screen.getByText('Capped the retry loop and added jitter.')).toBeDefined();
  });
});
