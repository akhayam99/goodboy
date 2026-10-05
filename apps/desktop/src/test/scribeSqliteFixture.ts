import { expect, vi } from 'vitest';
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
import type { MountGithubState } from '../store/types';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../store/storyHarness';

type GhResult = { stdout: string; stderr: string; exitCode: number };

export const gh = {
  run: vi.fn(async (_args: ReadonlyArray<string>, _options: unknown): Promise<GhResult> => ({
    stdout: '',
    stderr: '',
    exitCode: 0,
  })),
  push: vi.fn(async (_params: unknown): Promise<GhResult> => ({
    stdout: '',
    stderr: '',
    exitCode: 0,
  })),
};

export const githubModuleWithSpies = (original: Readonly<Record<string, unknown>>) => ({
  ...original,
  tauriGhRunner: { run: gh.run },
  gitPush: gh.push,
});

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const PROJECT_ID = 'project-ledger-core' as ProjectId;
export const MOUNT_ID = 'mount-ledger-core' as MountId;
export const BRANCH = 'fix/ledger-postings';
export const WORKTREE_PATH = '/tmp/goodboy-root/worktrees/ledger-core';
export const CREATED_URL = 'https://github.com/harborline/ledger-core/pull/418';
export const SCRIBE_KEY = `pr:${MOUNT_ID}`;
const AT = '2026-10-05T09:00:00.000Z' as IsoDateTime;

export const PROPOSAL = [
  '<<pr-title>>',
  'Guard settlement postings',
  '<</pr-title>>',
  '<<pr-body>>',
  'Retried batches no longer post twice.',
  '<</pr-body>>',
].join('\n');

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

export const scribeTurn =
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

export const plainTurn =
  ({ answer }: { readonly answer: string }) =>
  ({ runId }: RunArgs) =>
    (async function* stream(): AsyncIterable<TurnEvent> {
      yield text({ runId, delta: answer });
    })();

export const createdPr = (): PullRequestState => ({
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

export const createCalls = () =>
  gh.run.mock.calls.filter(([args]) => args[0] === 'pr' && args[1] === 'create');

export const createCall = () => createCalls().at(-1);

export const rejectCreate = ({ stderr }: { readonly stderr: string }) => {
  gh.run.mockImplementation(async (args) => ({
    stdout: '',
    stderr: args[0] === 'pr' && args[1] === 'create' ? stderr : '',
    exitCode: args[0] === 'pr' && args[1] === 'create' ? 1 : 0,
  }));
};

export const acceptCreate = () => {
  gh.run.mockImplementation(async (args) => ({
    stdout: args[0] === 'pr' && args[1] === 'create' ? `${CREATED_URL}\n` : '',
    stderr: '',
    exitCode: 0,
  }));
};

export const seedScribeBranch = async ({
  useAppStore,
}: {
  readonly useAppStore: StoryStore;
}): Promise<SessionId> => {
  gh.run.mockClear();
  gh.push.mockClear();
  const workspace = buildStoryWorkspace({
    id: WORKSPACE_ID,
    name: 'Harborline',
    slug: 'harborline',
  });
  const project = buildStoryProject({
    id: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    name: 'ledger-core',
    rootPath: '/tmp/goodboy-root/repos/ledger-core',
    baseBranch: 'main',
  });
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
  const routing = await import('../features/providers/routing');
  vi.mocked(routing.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'scribe-test-model',
    reason: 'preferred',
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
  const sessionId = session.id as SessionId;
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
  acceptCreate();
  return sessionId;
};

export const askScribe = ({
  useAppStore,
  sessionId,
  isDraft = true,
  base = null,
}: {
  readonly useAppStore: StoryStore;
  readonly sessionId: SessionId;
  readonly isDraft?: boolean;
  readonly base?: string | null;
}) =>
  useAppStore.getState().requestScribe({
    sessionId,
    mountId: MOUNT_ID,
    task: { kind: 'pr', closedPrNumber: null, references: [], isDraft, base },
  });

export const scribeWorkOf = ({ useAppStore }: { readonly useAppStore: StoryStore }) =>
  useAppStore.getState().scribeWork[SCRIBE_KEY];

export const scribeAgentIdOf = ({ useAppStore }: { readonly useAppStore: StoryStore }): AgentId => {
  const agentId = scribeWorkOf({ useAppStore })?.agentId;
  if (agentId === null || agentId === undefined) {
    throw new Error('the Scribe was never spawned');
  }
  return agentId;
};

export const settleScribeWork = async ({ useAppStore }: { readonly useAppStore: StoryStore }) => {
  await vi.waitFor(() => expect(scribeWorkOf({ useAppStore })?.status).not.toBe('writing'));
  await vi.waitFor(() =>
    expect(['ready', 'creating']).not.toContain(scribeWorkOf({ useAppStore })?.status),
  );
};

export const followUpToScribe = async ({
  useAppStore,
  sessionId,
  answer,
  content,
}: {
  readonly useAppStore: StoryStore;
  readonly sessionId: SessionId;
  readonly answer: string;
  readonly content: string;
}) => {
  storySpies.runTurn.mockImplementation(plainTurn({ answer }));
  await useAppStore
    .getState()
    .sendTurn({ sessionId, agentId: scribeAgentIdOf({ useAppStore }), content });
};

export const reloadScribeAgent = async ({
  useAppStore,
  sessionId,
}: {
  readonly useAppStore: StoryStore;
  readonly sessionId: SessionId;
}): Promise<AgentId> => {
  const agentId = scribeAgentIdOf({ useAppStore });
  useAppStore.setState({
    transcripts: {},
    messages: {},
    scribeWork: {},
    scribeAgents: {},
    mountGithub: {},
  });
  await useAppStore.getState().selectAgent(sessionId, agentId);
  return agentId;
};
