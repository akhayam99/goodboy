import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
  type WorkspaceId,
} from '@goodboy/types';
import {
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
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const AT = brandId<IsoDateTime>({ value: '2026-09-30T09:00:00.000Z' });
const WORKTREE_PATH = '/tmp/goodboy-root/worktrees/ledger-core';
const SCRATCH = '/scratch/session-harborline';

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });

let useAppStore: StoryStore;
let sessionId: SessionId;
let agentId: AgentId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const transcript = () => useAppStore.getState().transcripts[agentId] ?? [];

const STORED = [
  {
    id: 'attachment-banner',
    kind: 'image' as const,
    fileName: 'banner.png',
    mimeType: 'image/png',
    relPath: '.goodboy/attachments/scratch-banner.png',
    dir: SCRATCH,
  },
];

beforeEach(async () => {
  await resetStoryStore();
  await insertWorkspace({ db: await openStorySqlite(), workspace });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Reconcile the Harborline ledger export',
    firstAgentKind: 'generic',
  });
  sessionId = session.id;
  const [agent] = useAppStore.getState().sessionPhaseRuns[sessionId] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
  }
  agentId = agent.id;
  storySpies.writeAttachment.mockReset();
  storySpies.readAttachment.mockReset();
  storySpies.writeAttachment.mockResolvedValue('.goodboy/attachments/attachment-banner-banner.png');
  storySpies.readAttachment.mockResolvedValue('data:image/png;base64,aGFyYm9ybGluZQ==');
  useAppStore.setState({
    sessionProjectMounts: {
      [sessionId]: [
        {
          projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
          mountName: 'ledger-core',
          worktreePath: WORKTREE_PATH,
          repoRoot: '/tmp/goodboy-root/repos/ledger-core',
          branch: 'nw/fix-settlement-replay',
          mountId: brandId<MountId>({ value: 'mount-ledger-core' }),
          sessionId,
          lastWorktreePath: null,
          baseBranch: null,
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 0,
        },
      ],
    },
  });
});

const sayDone = ({ runId }: { readonly runId: ProviderRunId }) =>
  (async function* stream(): AsyncIterable<TurnEvent> {
    yield { kind: 'assistant_text', runId, delta: 'I read the banner.', at: AT };
  })();

describe('sendTurn on sqlite: stored images of a session with a worktree', () => {
  it('copies each image into the worktree the agent can read and names that copy', async () => {
    storySpies.runTurn.mockImplementation(sayDone);

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'The banner overlaps the totals on narrow screens.',
      storedAttachments: STORED,
    });

    expect(storySpies.readAttachment).toHaveBeenCalledWith(SCRATCH, STORED[0]?.relPath);
    expect(storySpies.writeAttachment).toHaveBeenCalledWith({
      worktreeDir: WORKTREE_PATH,
      attachmentId: 'attachment-banner',
      fileName: 'banner.png',
      dataBase64: 'aGFyYm9ybGluZQ==',
    });
    const prompt = storySpies.runTurn.mock.calls[0]?.[0]?.prompt;
    expect(prompt).toContain('.goodboy/attachments/attachment-banner-banner.png');
    expect(prompt).not.toContain(SCRATCH);
    expect(transcript().find((event) => event.kind === 'user_text')).toMatchObject({
      attachments: [expect.objectContaining({ id: 'attachment-banner' })],
    });
  });

  it('starts no turn and says so when the copy fails', async () => {
    storySpies.readAttachment.mockRejectedValue(new Error('attachment is gone'));

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'The banner overlaps the totals on narrow screens.',
      storedAttachments: STORED,
    });

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(transcript().find((event) => event.kind === 'error')).toMatchObject({
      message: expect.stringContaining('attachment is gone'),
    });
  });
});
