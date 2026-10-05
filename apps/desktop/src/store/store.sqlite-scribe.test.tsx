import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { insertProject, insertSessionMount, insertWorkspace } from '@goodboy/db';
import type {
  AgentId,
  IsoDateTime,
  MountId,
  ProjectId,
  ProviderRunId,
  PullRequestState,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';
import type { MountGithubState } from './types';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { AssistantText } from '../features/chat/components/TranscriptCards/AssistantText';
import { ToastProvider } from '../shared/components/Toast';
import { AgentBriefPullRequestText } from '../features/session/components/AgentDetailPane/AgentBriefPullRequestText';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

const gh = vi.hoisted(() => ({
  run: vi.fn(
    async (
      _args: ReadonlyArray<string>,
      _options: unknown,
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> => ({
      stdout: '',
      stderr: '',
      exitCode: 0,
    }),
  ),
  push: vi.fn(
    async (_params: unknown): Promise<{ stdout: string; stderr: string; exitCode: number }> => ({
      stdout: '',
      stderr: '',
      exitCode: 0,
    }),
  ),
}));

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());
vi.mock('../features/integrations/github/github', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  tauriGhRunner: { run: gh.run },
  gitPush: gh.push,
}));

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const PROJECT_ID = 'project-ledger-core' as ProjectId;
const MOUNT_ID = 'mount-ledger-core' as MountId;
const AT = '2026-10-05T09:00:00.000Z' as IsoDateTime;
const BRANCH = 'fix/ledger-postings';
const WORKTREE_PATH = '/tmp/goodboy-root/worktrees/ledger-core';
const CREATED_URL = 'https://github.com/harborline/ledger-core/pull/418';
const SCRIBE_KEY = `pr:${MOUNT_ID}`;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const project = buildStoryProject({
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/goodboy-root/repos/ledger-core',
  baseBranch: 'main',
});

let useAppStore: StoryStore;
let sessionId: SessionId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type RunArgs = { readonly runId: ProviderRunId };

const text = ({ runId, delta }: { readonly runId: ProviderRunId; readonly delta: string }) =>
  ({ kind: 'assistant_text', runId, delta, at: AT }) satisfies TurnEvent;

const bash = ({
  runId,
  toolUseId,
  command,
}: {
  readonly runId: ProviderRunId;
  readonly toolUseId: string;
  readonly command: string;
}): ReadonlyArray<TurnEvent> => [
  { kind: 'tool_call_start', runId, toolUseId, toolName: 'Bash', input: { command }, at: AT },
  { kind: 'tool_call_end', runId, toolUseId, output: 'ok', isError: false, at: AT },
];

const scribeTurn =
  ({ answer }: { readonly answer: string }) =>
  ({ runId }: RunArgs) =>
    (async function* stream(): AsyncIterable<TurnEvent> {
      yield text({ runId, delta: 'Reading the branch.\n' });
      const commands = ['git log main..HEAD', 'git diff main...HEAD --stat', 'git show HEAD', 'ls'];
      for (const [index, command] of commands.entries()) {
        yield* bash({ runId, toolUseId: `tool-${index}`, command });
      }
      yield text({ runId, delta: answer });
    })();

const PROPOSAL = [
  '<<pr-title>>',
  'Guard settlement postings',
  '<</pr-title>>',
  '<<pr-body>>',
  'Retried batches no longer post twice.',
  '<</pr-body>>',
].join('\n');

const createdPr = (): PullRequestState => ({
  number: 418,
  url: CREATED_URL,
  state: 'draft',
  title: 'Guard settlement postings',
  body: 'Retried batches no longer post twice.',
  mergeable: null,
  checks: null,
  baseBranch: 'main',
  headBranch: BRANCH,
  isDraft: true,
  reviewDecision: null,
  updatedAt: AT,
});

const githubOf = ({ pr }: { readonly pr: PullRequestState }): MountGithubState => ({
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  repository: 'harborline/ledger-core',
  host: 'github.com',
  branch: BRANCH,
  prs: [pr],
  links: [],
  pr,
  linkedIssues: [],
  fetchedAt: AT,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const createCalls = () =>
  gh.run.mock.calls.filter(([args]) => args[0] === 'pr' && args[1] === 'create');

const createCall = () => createCalls().at(-1);

const work = () => useAppStore.getState().scribeWork[SCRIBE_KEY];

const askScribe = () =>
  useAppStore.getState().requestScribe({
    sessionId,
    mountId: MOUNT_ID,
    task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: true, base: null },
  });

beforeEach(async () => {
  gh.run.mockClear();
  gh.push.mockClear();
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [project],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const routingMod = await import('../features/providers/routing');
  (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preference',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Make ledger postings idempotent',
    firstAgentKind: 'generic',
  });
  sessionId = session.id as SessionId;
  await insertSessionMount({
    db,
    mount: {
      id: MOUNT_ID,
      sessionId,
      projectId: PROJECT_ID,
      worktreePath: WORKTREE_PATH,
      lastWorktreePath: WORKTREE_PATH,
      branch: BRANCH,
      baseBranch: 'main',
      parallelIndex: 0,
      mountName: 'ledger-core',
      repoSlug: 'harborline/ledger-core',
      isAttached: true,
      diskState: 'present',
      revision: 0,
      createdAt: AT,
      updatedAt: AT,
    },
  });
  useAppStore.setState({
    sessionProjectMounts: {
      [sessionId]: [
        {
          projectId: PROJECT_ID,
          mountName: 'ledger-core',
          worktreePath: WORKTREE_PATH,
          repoRoot: project.rootPath,
          branch: BRANCH,
          mountId: MOUNT_ID,
          sessionId,
          lastWorktreePath: null,
          baseBranch: 'main',
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present' as const,
          revision: 0,
        },
      ],
    },
    sessionMounts: {
      [sessionId]: [
        {
          id: MOUNT_ID,
          sessionId,
          projectId: PROJECT_ID,
          mountName: 'ledger-core',
          worktreePath: WORKTREE_PATH,
          lastWorktreePath: WORKTREE_PATH,
          repoRoot: project.rootPath,
          branch: BRANCH,
          baseBranch: 'main',
          parallelIndex: 0,
          repoSlug: 'harborline/ledger-core',
          isAttached: true,
          diskState: 'present' as const,
          revision: 0,
          createdAt: AT,
          updatedAt: AT,
        },
      ],
    },
    sessionActiveMount: { [sessionId]: MOUNT_ID },
    refreshSessionPr: vi.fn(async () => {
      if (createCall() === undefined) {
        return;
      }
      useAppStore.setState({ mountGithub: { [MOUNT_ID]: githubOf({ pr: createdPr() }) } });
    }),
  });
  gh.run.mockImplementation(async (args) => ({
    stdout: args[0] === 'pr' && args[1] === 'create' ? `${CREATED_URL}\n` : '',
    stderr: '',
    exitCode: 0,
  }));
});

afterEach(async () => {
  cleanup();
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const settled = async () => {
  await vi.waitFor(() => expect(work()?.status).not.toBe('writing'));
  await vi.waitFor(() => expect(['ready', 'creating']).not.toContain(work()?.status));
};

const scribeAgentId = (): AgentId => {
  const agentId = work()?.agentId;
  if (agentId === null || agentId === undefined) {
    throw new Error('the Scribe was never spawned');
  }
  return agentId;
};

const plainTurn =
  ({ answer }: { readonly answer: string }) =>
  ({ runId }: RunArgs) =>
    (async function* stream(): AsyncIterable<TurnEvent> {
      yield text({ runId, delta: answer });
    })();

const followUp = async ({
  answer,
  content,
}: {
  readonly answer: string;
  readonly content: string;
}) => {
  storySpies.runTurn.mockImplementation(plainTurn({ answer }));
  await useAppStore.getState().sendTurn({ sessionId, agentId: scribeAgentId(), content });
};

const reload = async () => {
  const agentId = scribeAgentId();
  useAppStore.setState({
    transcripts: {},
    messages: {},
    scribeWork: {},
    scribeAgents: {},
    mountGithub: {},
  });
  await useAppStore.getState().selectAgent(sessionId, agentId);
};

const rejectCreate = ({ stderr }: { readonly stderr: string }) => {
  gh.run.mockImplementation(async (args) => ({
    stdout: '',
    stderr: args[0] === 'pr' && args[1] === 'create' ? stderr : '',
    exitCode: args[0] === 'pr' && args[1] === 'create' ? 1 : 0,
  }));
};

const acceptCreate = () => {
  gh.run.mockImplementation(async (args) => ({
    stdout: args[0] === 'pr' && args[1] === 'create' ? `${CREATED_URL}\n` : '',
    stderr: '',
    exitCode: 0,
  }));
};

const briefOf = ({ agentId = scribeAgentId() }: { readonly agentId?: AgentId } = {}) =>
  render(<AgentBriefPullRequestText sessionId={sessionId} agentId={agentId} />);

const transcriptCard = ({ agentId = scribeAgentId() }: { readonly agentId?: AgentId } = {}) =>
  render(
    <ToastProvider>
      <AssistantText text={PROPOSAL} sessionId={sessionId} agentId={agentId} />
    </ToastProvider>,
  );

describe('Create PR through the Scribe on a branch that was never pushed', () => {
  it('pushes the branch and opens the draft with the text the Scribe wrote after its tool calls', async () => {
    storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));

    await askScribe();
    await settled();

    expect(work()?.status).toBe('created');
    expect(gh.push).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ cwd: WORKTREE_PATH, branch: BRANCH }),
    );
    const create = createCall();
    const args = create?.[0] ?? [];
    expect(args).toContain('--draft');
    expect(args[args.indexOf('--title') + 1]).toBe('Guard settlement postings');
    expect(args[args.indexOf('--body') + 1]).toContain('Retried batches no longer post twice.');
    expect(gh.push.mock.invocationCallOrder[0]).toBeLessThan(
      gh.run.mock.invocationCallOrder[gh.run.mock.calls.indexOf(create!)] ?? 0,
    );
    expect(useAppStore.getState().mountGithub[MOUNT_ID]?.pr?.number).toBe(418);
  });
});

describe('when opening the pull request fails', () => {
  it('keeps the text, shows the reason in the Brief and opens the draft on Retry', async () => {
    rejectCreate({ stderr: 'GraphQL: Resource not accessible by personal access token' });
    storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));

    await askScribe();
    await settled();

    expect(work()).toMatchObject({
      status: 'failed',
      error: 'GraphQL: Resource not accessible by personal access token',
      output: { prTitle: 'Guard settlement postings' },
    });
    briefOf();
    expect(screen.getByText('Guard settlement postings')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe(
      'GraphQL: Resource not accessible by personal access token',
    );

    acceptCreate();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await screen.findByText('Created #418');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(work()?.status).toBe('created');
  });

  it('names a refused push and never reaches gh', async () => {
    gh.push.mockResolvedValueOnce({
      stdout: '',
      stderr: '! [rejected] fix/ledger-postings -> fix/ledger-postings (non-fast-forward)',
      exitCode: 1,
    });
    storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));

    await askScribe();
    await settled();

    expect(work()?.status).toBe('failed');
    expect(work()?.error).toBe(
      "Couldn't push fix/ledger-postings: ! [rejected] fix/ledger-postings -> fix/ledger-postings (non-fast-forward)",
    );
    expect(createCall()).toBeUndefined();
  });
});

describe('talking to the Scribe after it wrote the text', () => {
  it('keeps the proposal in the Brief when the answer brings no new text', async () => {
    storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));
    await askScribe();
    await settled();

    await followUp({
      answer: 'got it - PR text ready, engine creates the draft. standing by.',
      content: "didn't you create the PR?",
    });

    briefOf();
    expect(screen.getByText('Guard settlement postings')).toBeDefined();
    expect(screen.getByText('Retried batches no longer post twice.')).toBeDefined();
    expect(work()).toMatchObject({ status: 'created', pullRequest: { number: 418 } });
    expect(gh.run.mock.calls.filter(([args]) => args[1] === 'create')).toHaveLength(1);
  });

  it('changes only what the follow-up rewrites', async () => {
    storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));
    await askScribe();
    await settled();

    await followUp({
      answer: '<<pr-body>>\nPostings are keyed by event id.\n<</pr-body>>',
      content: 'shorter body please',
    });

    briefOf();
    expect(screen.getByText('Guard settlement postings')).toBeDefined();
    expect(screen.getByText('Postings are keyed by event id.')).toBeDefined();
    expect(screen.queryByText('Retried batches no longer post twice.')).toBeNull();
    expect(work()?.output).toMatchObject({
      prTitle: 'Guard settlement postings',
      prBody: 'Postings are keyed by event id.',
    });
  });

  it('opens the draft from a follow-up when the first try failed', async () => {
    rejectCreate({ stderr: 'gh: command not found' });
    storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));
    await askScribe();
    await settled();
    expect(work()?.status).toBe('failed');

    acceptCreate();
    await followUp({
      answer: '<<pr-title>>Guard every settlement posting<</pr-title>>',
      content: 'make the title stronger',
    });
    await settled();

    expect(work()).toMatchObject({ status: 'created', pullRequest: { number: 418 } });
    const args = createCall()?.[0] ?? [];
    expect(args[args.indexOf('--title') + 1]).toBe('Guard every settlement posting');
  });
});

describe('after the app reloads', () => {
  it('still shows the proposal in the Brief and creates the draft from there', async () => {
    storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));
    await askScribe();
    await settled();
    const agentId = scribeAgentId();

    await reload();
    gh.run.mockClear();
    gh.push.mockClear();
    briefOf({ agentId });

    expect(await screen.findByText('Guard settlement postings')).toBeDefined();
    expect(screen.getByText('Retried batches no longer post twice.')).toBeDefined();
    expect(screen.getByText('Not opened yet')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Create PR' }));

    await screen.findByText('Created #418');
    expect(useAppStore.getState().scribeAgents[agentId]).toBe(SCRIBE_KEY);
    expect(createCall()).toBeDefined();
  });

  it('keeps the card in the transcript with its state', async () => {
    storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));
    await askScribe();
    await settled();
    const agentId = scribeAgentId();

    await reload();
    transcriptCard({ agentId });

    const card = await screen.findByTestId('scribe-proposal');
    expect(card.textContent).toContain('Pull request text');
    expect(card.textContent).toContain('Guard settlement postings');
    expect(card.textContent).toContain('Not opened yet');
    expect(screen.queryByText('<<pr-title>>')).toBeNull();
  });

  it('shows Created in the card once the engine opened the draft', async () => {
    storySpies.runTurn.mockImplementation(scribeTurn({ answer: PROPOSAL }));
    await askScribe();
    await settled();

    transcriptCard();

    await waitFor(() =>
      expect(screen.getByTestId('scribe-proposal').textContent).toContain('Created #418'),
    );
  });
});
