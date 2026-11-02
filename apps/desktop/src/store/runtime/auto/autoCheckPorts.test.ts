// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import {
  brandId,
  type MountId,
  type Project,
  type ProjectId,
  type SessionId,
  type SessionProjectMount,
  type WorkspaceId,
} from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { autoChecksKey } from '../../../features/scripts/autoChecksKey';
import { scriptPinId } from '../../../features/scripts/scriptPinId';
import { listAutoChecks } from './listAutoChecks';
import { runAutoCheckScript } from './runAutoCheckScript';

type ExitHandler = (payload: { runId: string; exitCode: number }) => void;

const scripts = vi.hoisted(() => {
  const exit: { handler: ((payload: { runId: string; exitCode: number }) => void) | null } = {
    handler: null,
  };
  return {
    exit,
    cancelSpy: vi.fn(async (_runId: string) => undefined),
    listenScriptExitSpy: vi.fn(
      async (handler: (payload: { runId: string; exitCode: number }) => void) => {
        exit.handler = handler;
        return () => undefined;
      },
    ),
  };
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/onboarding/onboardingSettings', async () =>
  (await import('../../storyHarness')).onboardingStoreModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../shared/lib/editor', async () =>
  (await import('../../storyHarness')).editorModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);
vi.mock('../../../features/integrations/linear/client', async () =>
  (await import('../../storyHarness')).linearClientModuleMock(),
);
vi.mock('../../../features/integrations/github/github', async () =>
  (await import('../../storyHarness')).githubModuleMock(),
);
vi.mock('@goodboy/core', async (importOriginal) =>
  (await import('../../storyHarness')).coreModuleMock(importOriginal),
);
vi.mock('../../../features/scripts/scripts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/scripts/scripts')>()),
  ...(await import('../../storyHarness')).scriptsModuleMock(),
  invokeScriptCancel: scripts.cancelSpy,
  listenScriptExit: scripts.listenScriptExitSpy,
}));
vi.mock('../../../features/terminal/terminal', async () =>
  (await import('../../storyHarness')).terminalModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const PROJECT = brandId<ProjectId>({ value: 'project-ledger-core' });
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const WORKTREE = '/work/harborline/ledger-core';

const MOUNT_VIEW: SessionProjectMount = {
  mountId: MOUNT,
  projectId: PROJECT,
  mountName: 'ledger-core',
  worktreePath: WORKTREE,
  repoRoot: WORKTREE,
  branch: 'ak/ledger-export',
  sessionId: SESSION,
  lastWorktreePath: null,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

const PROJECT_ROW: Project = aProject({
  id: PROJECT,
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
  name: 'ledger-core',
  rootPath: WORKTREE,
  kind: 'repo',
});

const GROUP = {
  source: 'package-json' as const,
  packageName: 'ledger-core',
  relDir: '',
  manager: 'pnpm',
  scripts: [
    { name: 'typecheck', command: 'pnpm run typecheck', body: 'tsc --noEmit' },
    { name: 'lint', command: 'pnpm run lint', body: 'eslint .' },
  ],
};

const TYPECHECK_ID = scriptPinId({
  source: 'package-json',
  relDir: '',
  name: 'typecheck',
  savedId: null,
});
const LINT_ID = scriptPinId({ source: 'package-json', relDir: '', name: 'lint', savedId: null });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type TickParams = {
  readonly ticked: ReadonlyArray<string>;
};

const prepare = ({ ticked }: TickParams): void => {
  storySpies.scanProjectScripts.mockResolvedValue([GROUP]);
  useAppStore.setState({
    projects: [PROJECT_ROW],
    sessionProjectMounts: { [SESSION]: [MOUNT_VIEW] },
    settings: { [autoChecksKey({ projectId: PROJECT })]: JSON.stringify(ticked) },
  });
};

const getState = () => useAppStore.getState();

describe('the scripts a user ticked as Auto checks', () => {
  beforeEach(async () => {
    await resetStoryStore();
    scripts.exit.handler = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('lists the ticked scripts of the mount and no other', async () => {
    prepare({ ticked: [TYPECHECK_ID] });

    const listed = await listAutoChecks({
      getState,
      params: { sessionId: SESSION, mountId: MOUNT },
    });

    expect(listed).toEqual({ scripts: [{ id: TYPECHECK_ID, name: 'typecheck' }], missing: [] });
  });

  it('names every ticked script the branch does not have instead of dropping it', async () => {
    prepare({
      ticked: [
        TYPECHECK_ID,
        scriptPinId({
          source: 'package-json',
          relDir: 'packages/api',
          name: 'test',
          savedId: null,
        }),
        scriptPinId({ source: 'package-json', relDir: '', name: 'build', savedId: null }),
      ],
    });

    const listed = await listAutoChecks({
      getState,
      params: { sessionId: SESSION, mountId: MOUNT },
    });

    expect(listed).toEqual({
      scripts: [{ id: TYPECHECK_ID, name: 'typecheck' }],
      missing: ['packages/api/test', 'build'],
    });
  });

  it('lists nothing when no script is ticked', async () => {
    prepare({ ticked: [] });

    const listed = await listAutoChecks({
      getState,
      params: { sessionId: SESSION, mountId: MOUNT },
    });

    expect(listed).toEqual({ scripts: [], missing: [] });
  });

  it('lists nothing for a mount the session does not have', async () => {
    prepare({ ticked: [TYPECHECK_ID] });

    const listed = await listAutoChecks({
      getState,
      params: { sessionId: SESSION, mountId: 'mount-gone' },
    });

    expect(listed).toEqual({ scripts: [], missing: [] });
  });

  const runWith = ({ timeoutMs, id = TYPECHECK_ID }: { timeoutMs: number; id?: string }) =>
    runAutoCheckScript({
      getState,
      params: {
        sessionId: SESSION,
        mountId: MOUNT,
        worktreePath: WORKTREE,
        check: { id, name: 'typecheck' },
        timeoutMs,
      },
    });

  const exitRun = async ({ exitCode }: { exitCode: number }): Promise<void> => {
    await vi.waitFor(() => expect(storySpies.runAdhocScript).toHaveBeenCalled());
    const invocation = storySpies.runAdhocScript.mock.calls.at(-1)?.[0];
    const handler: ExitHandler | null = scripts.exit.handler;
    if (invocation?.runId === undefined || handler === null) {
      throw new Error('the script listeners were not ready');
    }
    handler({ runId: invocation.runId, exitCode });
  };

  it('reads pass when the script exits with zero, in the worktree of the agent', async () => {
    prepare({ ticked: [TYPECHECK_ID, LINT_ID] });

    const status = runWith({ timeoutMs: 60_000 });
    await exitRun({ exitCode: 0 });

    expect(await status).toBe('pass');
    expect(storySpies.runAdhocScript.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ body: 'pnpm run typecheck', cwd: WORKTREE }),
    );
  });

  it('reads fail when the script exits with an error code', async () => {
    prepare({ ticked: [TYPECHECK_ID] });

    const status = runWith({ timeoutMs: 60_000 });
    await exitRun({ exitCode: 2 });

    expect(await status).toBe('fail');
  });

  it('reads unknown, never pass, when the script could not start', async () => {
    prepare({ ticked: [TYPECHECK_ID] });
    storySpies.runAdhocScript.mockRejectedValueOnce(new Error('no shell'));

    expect(await runWith({ timeoutMs: 60_000 })).toBe('unknown');
  });

  it('reads unknown for a script that is no longer ticked', async () => {
    prepare({ ticked: [LINT_ID] });

    expect(await runWith({ timeoutMs: 60_000 })).toBe('unknown');
    expect(storySpies.runAdhocScript).not.toHaveBeenCalled();
  });

  it('cancels a script that takes too long and answers only once the process ended', async () => {
    prepare({ ticked: [TYPECHECK_ID] });
    vi.useFakeTimers();
    let answer: string | null = null;

    const status = runWith({ timeoutMs: 5_000 }).then((value) => {
      answer = value;
      return value;
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(scripts.cancelSpy).toHaveBeenCalledTimes(1);
    expect(answer).toBeNull();
    await exitRun({ exitCode: 143 });
    expect(await status).toBe('timed_out');
  });

  it('runs no check on a worktree whose stopped script is still alive, until it ends', async () => {
    prepare({ ticked: [TYPECHECK_ID] });
    vi.useFakeTimers();

    const status = runWith({ timeoutMs: 5_000 });
    await vi.advanceTimersByTimeAsync(6_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await status).toBe('timed_out');
    const started = storySpies.runAdhocScript.mock.calls.length;

    expect(await runWith({ timeoutMs: 5_000 })).toBe('unknown');
    expect(storySpies.runAdhocScript.mock.calls.length).toBe(started);

    await exitRun({ exitCode: 143 });
    await vi.advanceTimersByTimeAsync(0);
    const next = runWith({ timeoutMs: 60_000 });
    await vi.waitFor(() => expect(storySpies.runAdhocScript.mock.calls.length).toBe(started + 1));
    await exitRun({ exitCode: 0 });
    expect(await next).toBe('pass');
  });
});
