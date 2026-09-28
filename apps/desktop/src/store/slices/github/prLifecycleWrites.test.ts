import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  run: vi.fn(async (_args: ReadonlyArray<string>, _opts: unknown) => ({
    exitCode: 0,
    stdout: '',
    stderr: '',
  })),
}));

vi.mock('../../../features/github/github', () => ({ tauriGhRunner: { run: h.run } }));

import { closePr } from './closePr';
import { convertPrToDraft } from './convertPrToDraft';
import { editPr } from './editPr';
import { markPrReady } from './markPrReady';
import { mergePr } from './mergePr';
import {
  PR_WRITE_NO_PULL_REQUEST,
  PR_WRITE_NO_REPO,
  PR_WRITE_NO_SESSION,
  PR_WRITE_NO_WORKSPACE,
} from './prWriteContext';
import { reopenPr } from './reopenPr';
import { requestReview } from './requestReview';
import { isReportedError } from '../notifications/reportedError';

const SESSION_ID = 'session-1' as SessionId;
const LEDGER_ID = 'project-ledger' as ProjectId;
const RELAY_ID = 'project-relay' as ProjectId;
const LEDGER_MOUNT_ID = 'mount-ledger' as MountId;
const RELAY_MOUNT_ID = 'mount-relay' as MountId;

type State = Record<string, unknown>;

const mount = ({
  mountId,
  projectId,
  name,
  parallelIndex,
}: {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly parallelIndex: number;
}) => ({
  mountId,
  sessionId: SESSION_ID,
  projectId,
  mountName: name,
  worktreePath: `/worktrees/${name}`,
  lastWorktreePath: `/worktrees/${name}`,
  repoRoot: `/repos/${name}`,
  branch: `ak/${name}`,
  baseBranch: null,
  parallelIndex,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const makeState = (): State => ({
  sessions: [
    {
      id: SESSION_ID,
      workspaceId: 'workspace-1',
      activeMountId: LEDGER_MOUNT_ID,
      activeProjectId: LEDGER_ID,
    },
  ],
  workspaces: [{ id: 'workspace-1' }],
  projects: [
    { id: LEDGER_ID, workspaceId: 'workspace-1', kind: 'repo', name: 'ledger-core' },
    { id: RELAY_ID, workspaceId: 'workspace-1', kind: 'repo', name: 'notify-relay' },
  ],
  sessionActiveMount: { [SESSION_ID]: LEDGER_MOUNT_ID },
  sessionActiveProject: { [SESSION_ID]: LEDGER_ID },
  sessionMounts: {},
  sessionProjectMounts: {
    [SESSION_ID]: [
      mount({
        mountId: LEDGER_MOUNT_ID,
        projectId: LEDGER_ID,
        name: 'ledger-core',
        parallelIndex: 0,
      }),
      mount({
        mountId: RELAY_MOUNT_ID,
        projectId: RELAY_ID,
        name: 'notify-relay',
        parallelIndex: 0,
      }),
    ],
  },
  sessionGithub: {
    [SESSION_ID]: { pr: { number: 12, title: 'Ledger change', url: 'https://example.test/12' } },
  },
  mountGithub: {
    [RELAY_MOUNT_ID]: {
      pr: null,
      prs: [{ number: 44, title: 'Relay change', url: 'https://example.test/44' }],
    },
  },
  claimPrWrite: vi.fn(() => ({ ok: true, token: 'token-1' })),
  releasePrWrite: vi.fn(),
  emitNotification: vi.fn(async () => undefined),
  reportError: vi.fn(async () => undefined),
  refreshSessionPrDetail: vi.fn(async () => undefined),
  refreshSessionPr: vi.fn(async () => undefined),
  recordSessionEventOnce: vi.fn(async () => undefined),
});

beforeEach(() => {
  vi.clearAllMocks();
  h.run.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
});

describe('pull request writes with two mounts', () => {
  it('marks the pull request ready in the mount it names, not the active one', async () => {
    const state = makeState();

    await markPrReady(vi.fn(), (() => state) as never)(SESSION_ID, 44, {
      mountId: RELAY_MOUNT_ID,
    });

    expect(h.run).toHaveBeenCalledWith(['pr', 'ready', '44'], {
      cwd: '/repos/notify-relay',
      workspaceId: 'workspace-1',
      projectId: RELAY_ID,
    });
    expect(state.claimPrWrite).toHaveBeenCalledWith({
      projectId: RELAY_ID,
      prNumber: 44,
      action: 'ready',
    });
    expect(state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      force: true,
      mountId: RELAY_MOUNT_ID,
    });
    expect(state.recordSessionEventOnce).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'pr_ready',
      payload: { number: 44, title: 'Relay change', url: 'https://example.test/44' },
    });
  });

  it('merges the pull request in the mount it names, not the active one', async () => {
    const state = makeState();

    await mergePr(vi.fn(), (() => state) as never)(SESSION_ID, 44, 'rebase', {
      mountId: RELAY_MOUNT_ID,
    });

    expect(h.run).toHaveBeenCalledWith(['pr', 'merge', '44', '--rebase'], {
      cwd: '/repos/notify-relay',
      workspaceId: 'workspace-1',
      projectId: RELAY_ID,
    });
    expect(state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      force: true,
      mountId: RELAY_MOUNT_ID,
    });
  });

  it('keeps the active mount when no mount is named', async () => {
    const state = makeState();

    await mergePr(vi.fn(), (() => state) as never)(SESSION_ID, 12);

    expect(h.run).toHaveBeenCalledWith(['pr', 'merge', '12', '--squash'], {
      cwd: '/repos/ledger-core',
      workspaceId: 'workspace-1',
      projectId: LEDGER_ID,
    });
    expect(state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, { force: true });
  });
});

type Verb = (params: { readonly state: State; readonly prNumber?: number }) => Promise<void>;

const asGet = (state: State) => (() => state) as never;

const VERBS: ReadonlyArray<{
  readonly name: string;
  readonly title: string;
  readonly hasOptionalNumber: boolean;
  readonly call: Verb;
}> = [
  {
    name: 'markPrReady',
    title: "Couldn't mark #12 ready",
    hasOptionalNumber: true,
    call: ({ state, prNumber }) => markPrReady(vi.fn(), asGet(state))(SESSION_ID, prNumber),
  },
  {
    name: 'convertPrToDraft',
    title: "Couldn't convert #12 to a draft",
    hasOptionalNumber: true,
    call: ({ state, prNumber }) => convertPrToDraft(vi.fn(), asGet(state))(SESSION_ID, prNumber),
  },
  {
    name: 'mergePr',
    title: "Couldn't merge #12",
    hasOptionalNumber: true,
    call: ({ state, prNumber }) => mergePr(vi.fn(), asGet(state))(SESSION_ID, prNumber),
  },
  {
    name: 'closePr',
    title: "Couldn't close #12",
    hasOptionalNumber: true,
    call: ({ state, prNumber }) => closePr(vi.fn(), asGet(state))(SESSION_ID, prNumber),
  },
  {
    name: 'reopenPr',
    title: "Couldn't reopen #12",
    hasOptionalNumber: true,
    call: ({ state, prNumber }) => reopenPr(vi.fn(), asGet(state))(SESSION_ID, prNumber),
  },
  {
    name: 'editPr',
    title: "Couldn't edit the pull request",
    hasOptionalNumber: false,
    call: ({ state, prNumber }) =>
      editPr(vi.fn(), asGet(state))(SESSION_ID, prNumber ?? 12, { title: 'Ledger change' }),
  },
  {
    name: 'requestReview',
    title: "Couldn't request a review",
    hasOptionalNumber: false,
    call: ({ state, prNumber }) =>
      requestReview(vi.fn(), asGet(state))(SESSION_ID, prNumber ?? 12, ['octo-reviewer']),
  },
];

const expectLoudFailure = async ({
  run,
  state,
  title,
  message,
}: {
  readonly run: Promise<void>;
  readonly state: State;
  readonly title: string;
  readonly message: string;
}) => {
  const error = await run.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(Error);
  expect(isReportedError(error)).toBe(true);
  expect((error as Error).message).toBe(message);
  expect(state.reportError).toHaveBeenCalledTimes(1);
  expect(state.reportError).toHaveBeenCalledWith(
    expect.objectContaining({ title, error: new Error(message), sessionId: SESSION_ID }),
  );
  expect(h.run).not.toHaveBeenCalled();
};

describe.each(VERBS)('$name without what it needs', ({ title, hasOptionalNumber, call }) => {
  it('fails loudly when the workspace is missing', async () => {
    const state = { ...makeState(), workspaces: [] };

    await expectLoudFailure({
      run: call({ state, prNumber: 12 }),
      state,
      title,
      message: PR_WRITE_NO_WORKSPACE,
    });
  });

  it('fails loudly when no repository is mounted', async () => {
    const state = { ...makeState(), sessionProjectMounts: { [SESSION_ID]: [] } };

    await expectLoudFailure({
      run: call({ state, prNumber: 12 }),
      state,
      title,
      message: PR_WRITE_NO_REPO,
    });
  });

  it('fails loudly when the session is gone', async () => {
    const state = { ...makeState(), sessions: [] };

    await expectLoudFailure({
      run: call({ state, prNumber: 12 }),
      state,
      title,
      message: PR_WRITE_NO_SESSION,
    });
  });

  it.runIf(hasOptionalNumber)('fails loudly when there is no pull request to act on', async () => {
    const state = { ...makeState(), sessionGithub: {} };

    await expectLoudFailure({
      run: call({ state }),
      state,
      title: title.replace('#12', 'the pull request'),
      message: PR_WRITE_NO_PULL_REQUEST,
    });
  });
});
