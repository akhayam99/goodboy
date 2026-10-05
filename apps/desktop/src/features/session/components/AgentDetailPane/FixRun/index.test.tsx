// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, MountId, ResolveAttempt } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { agentPlace, branchPlace } from '../../../../../store/slices/navigation/place';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  seedResolveScene,
} from '../../../../../app/components/MockScene/scenes/resolveSeed';
import { resolverBriefOf } from '../../../../resolve/hooks/useResolverBrief';
import { FixRun } from '.';

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

const SINGLE = 'agent-fix-single' as AgentId;
const CHILD = 'agent-fix-child' as AgentId;
const SIBLING = 'agent-fix-sibling' as AgentId;
const GONE = 'agent-fix-gone' as AgentId;
const CHILD_MOUNT = 'mount-fix-child' as MountId;
const TYPO = 'PRRT_thread_typo';
const CONSTANT = 'PRRT_thread_retry_constant';

const attemptOf = ({
  id,
  agentId,
  threadIds,
  batchId,
  mountTarget = null,
}: {
  readonly id: string;
  readonly agentId: AgentId;
  readonly threadIds: ReadonlyArray<string>;
  readonly batchId: string | null;
  readonly mountTarget?: ResolveAttempt['mountTarget'];
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
  phase: 'finished',
  mountTarget,
  startedAt: 1,
  endedAt: 2,
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
  status: 'completed',
  outputSummary: 'Capped the retry loop and added jitter.',
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

const mount = async ({ agentId }: { readonly agentId: AgentId }): Promise<void> => {
  seedResolveScene({ expandedThreadId: null });
  useAppStore.setState({ sessionResolveAttempts: { [SESSION.id]: ATTEMPTS } });
  const brief = resolverBriefOf({ attempts: ATTEMPTS, agentId });
  if (brief === null) {
    throw new Error('no brief');
  }
  render(<FixRun session={SESSION} agent={agentOf(agentId)} brief={brief} />);
  await settle();
};

describe('the Fix run', () => {
  it('says what the resolver did and lists the comment it touched', async () => {
    await mount({ agentId: SINGLE });

    expect(screen.getByRole('heading', { name: 'What it did' })).toBeDefined();
    expect(screen.getByText('Capped the retry loop and added jitter.')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Commits' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Comments it touched' })).toBeDefined();
    expect(screen.queryByText(/Fixed together with/)).toBeNull();
  });

  it('has no control that changes the comment, only links out', async () => {
    await mount({ agentId: SINGLE });

    expect(screen.queryByRole('button', { name: /^Accept/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Push/ })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('opens a touched comment on the Comments tab of the Branch', async () => {
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
    });
  });

  it('links to the transcript of the run', async () => {
    const navigate = vi.fn<StoreState['navigate']>();
    stub({ navigate });
    await mount({ agentId: SINGLE });

    fireEvent.click(screen.getByRole('button', { name: 'Open transcript' }));

    expect(navigate).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: SESSION.id, agentId: SINGLE, pane: 'transcript' }),
    });
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
    expect(screen.getByText('This run left no commit.')).toBeDefined();
  });
});
