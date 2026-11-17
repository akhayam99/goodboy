// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  MountId,
  Project,
  ProjectScript,
  ProjectScriptId,
  SessionProjectMount,
  Workspace,
} from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { TEST_NOW, aProject, aSession, aWorkspace, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import { toggleSessionTerminal } from '../terminal/toggleSessionTerminal';
import { resolveScriptMount } from './resolveScriptMount';
import { runPinnedScript } from './runPinnedScript';
import { scriptPinId } from './scriptPinId';
import { scriptPinsKey } from './scriptPinsKey';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const LEDGER: Project = aProject({
  workspaceId: HARBORLINE.id,
  name: 'ledger-core',
  rootPath: '/repos/ledger-core',
  kind: 'repo',
  baseBranch: 'main',
});
const RELAY: Project = aProject({
  workspaceId: HARBORLINE.id,
  name: 'notify-relay',
  rootPath: '/repos/notify-relay',
  kind: 'repo',
  baseBranch: 'main',
});
const SESSION = aSession({ workspaceId: HARBORLINE.id, goal: 'Round the ledger' });
const OTHER = aSession({ workspaceId: HARBORLINE.id, goal: 'Retry the webhooks' });

type MountParams = {
  readonly project: Project;
  readonly branch: string;
};

type IdParams = {
  readonly value: string;
};

const isMountId = (value: string): value is MountId => value.startsWith('mount-');

const isScriptId = (value: string): value is ProjectScriptId => value.startsWith('script-');

const mountIdOf = ({ value }: IdParams): MountId => {
  if (!isMountId(value)) {
    throw new Error(`Not a mount id: ${value}`);
  }
  return value;
};

const scriptIdOf = ({ value }: IdParams): ProjectScriptId => {
  if (!isScriptId(value)) {
    throw new Error(`Not a script id: ${value}`);
  }
  return value;
};

const mountOf = ({ project, branch }: MountParams): SessionProjectMount => {
  const slug = branch.replace('/', '-');
  return {
    mountId: mountIdOf({ value: `mount-${slug}` }),
    sessionId: SESSION.id,
    projectId: project.id,
    mountName: project.name,
    worktreePath: `/worktrees/${slug}`,
    lastWorktreePath: null,
    repoRoot: project.rootPath,
    branch,
    baseBranch: 'main',
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 1,
  };
};

const SETTLEMENT = mountOf({ project: LEDGER, branch: 'hl/settlement' });
const ROUNDING = mountOf({ project: LEDGER, branch: 'hl/fix-rounding' });
const WEBHOOKS = mountOf({ project: RELAY, branch: 'hl/webhooks' });

const REPLAY: ProjectScript = {
  id: scriptIdOf({ value: 'script-replay' }),
  projectId: LEDGER.id,
  name: 'Replay settlement batch',
  body: 'pnpm replay',
  sortOrder: 0,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

const REPLAY_PIN = scriptPinId({
  source: 'saved',
  relDir: '',
  name: REPLAY.name,
  savedId: REPLAY.id,
});

const invokes = (command: string): ReadonlyArray<Readonly<Record<string, unknown>>> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === command)
    .flatMap(([, args]) => (isRecord(args) ? [args] : []));

type SeedParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const seed = ({ mounts }: SeedParams) => {
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    projects: [LEDGER, RELAY],
    sessions: [SESSION, OTHER],
    currentSessionId: SESSION.id,
    sessionProjectMounts: { [SESSION.id]: mounts },
    projectScripts: { [HARBORLINE.id]: [REPLAY] },
    activeLens: {},
    selectedAgentId: {},
    diffMountPath: {},
    sessionActiveMount: { [SESSION.id]: SETTLEMENT.mountId },
  });
};

const outcomeOf = ({ projectId }: { readonly projectId: Project['id'] | null }) =>
  resolveScriptMount({
    state: useAppStore.getState(),
    sessionId: SESSION.id,
    projectId,
    mountId: null,
  });

const branchOf = (outcome: ReturnType<typeof resolveScriptMount>): string | null =>
  outcome.kind === 'run' ? outcome.mount.branch : null;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    workspace_script_run: null,
    workspace_script_run_adhoc: 'run-next',
    workspace_script_cancel: null,
    workspace_script_list_live: [],
    project_scripts_scan: [],
    process_ledger_list: [],
  });
});

describe('where a script runs, two branches of one project', () => {
  it('runs on the branch page on screen, not the mount the next turn writes to', () => {
    seed({ mounts: [SETTLEMENT, ROUNDING] });
    useAppStore.setState({
      activeLens: { [SESSION.id]: 'branch' },
      diffMountPath: { [SESSION.id]: ROUNDING.worktreePath },
    });

    expect(branchOf(outcomeOf({ projectId: LEDGER.id }))).toBe('hl/fix-rounding');
  });

  it('runs on the branch of the agent page the user is on', () => {
    seed({ mounts: [SETTLEMENT, ROUNDING] });
    const agent: Agent = { ...anAgent({ sessionId: SESSION.id }), mountId: ROUNDING.mountId };
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION.id]: [agent] },
      selectedAgentId: { [SESSION.id]: agent.id },
    });

    expect(branchOf(outcomeOf({ projectId: LEDGER.id }))).toBe('hl/fix-rounding');
  });

  it('asks on the session level, the branch that ran a script last first', () => {
    seed({ mounts: [SETTLEMENT, ROUNDING] });
    useAppStore.setState({
      scriptRuns: {
        [SESSION.id]: {
          earlier: {
            status: 'ok',
            result: null,
            runId: 'run-earlier',
            startedAt: 10,
            mountId: ROUNDING.mountId,
          },
        },
      },
    });

    const outcome = outcomeOf({ projectId: LEDGER.id });

    expect(outcome.kind).toBe('ask');
    expect(outcome.kind === 'ask' ? outcome.mounts.map((mount) => mount.branch) : []).toEqual([
      'hl/fix-rounding',
      'hl/settlement',
    ]);
  });

  it('runs the saved script in the worktree of the branch the user picked', async () => {
    seed({ mounts: [SETTLEMENT, ROUNDING] });

    void runPinnedScript({
      sessionId: SESSION.id,
      workspaceId: HARBORLINE.id,
      projectId: LEDGER.id,
      mountId: ROUNDING.mountId,
      pinId: REPLAY_PIN,
    });

    await vi.waitFor(() => expect(invokes('workspace_script_run')).toHaveLength(1));
    expect(invokes('workspace_script_run')[0]?.cwd).toBe(ROUNDING.worktreePath);
  });

  it('refuses a second branch while the saved script runs on the first, and names it', async () => {
    seed({ mounts: [SETTLEMENT, ROUNDING] });
    const params = {
      sessionId: SESSION.id,
      workspaceId: HARBORLINE.id,
      projectId: LEDGER.id,
      pinId: REPLAY_PIN,
    };
    void runPinnedScript({ ...params, mountId: SETTLEMENT.mountId });
    await vi.waitFor(() => expect(invokes('workspace_script_run')).toHaveLength(1));

    const second = await runPinnedScript({ ...params, mountId: ROUNDING.mountId });

    expect(second.kind === 'ran' ? second.result.stderr : null).toBe(
      'Already running on hl/settlement',
    );
    expect(invokes('workspace_script_run')).toHaveLength(1);
    expect(useAppStore.getState().scriptRuns[SESSION.id]?.[REPLAY.id]?.mountId).toBe(
      SETTLEMENT.mountId,
    );
  });

  it('starts no second run when the script is clicked again on the branch it runs on', async () => {
    seed({ mounts: [SETTLEMENT, ROUNDING] });
    const params = {
      sessionId: SESSION.id,
      workspaceId: HARBORLINE.id,
      projectId: LEDGER.id,
      mountId: SETTLEMENT.mountId,
      pinId: REPLAY_PIN,
    };
    void runPinnedScript(params);
    await vi.waitFor(() => expect(invokes('workspace_script_run')).toHaveLength(1));

    const second = await runPinnedScript(params);

    expect(second.kind === 'ran' ? second.result.stderr : null).toBe('Already running');
    expect(invokes('workspace_script_run')).toHaveLength(1);
  });

  it('drops a pinned run whose scan answers after the user switched session', async () => {
    seed({ mounts: [SETTLEMENT, ROUNDING] });
    const devPin = scriptPinId({ source: 'package-json', relDir: '', name: 'dev', savedId: null });
    useAppStore.setState((state) => ({
      settings: {
        ...state.settings,
        [scriptPinsKey({ projectId: LEDGER.id })]: JSON.stringify([devPin]),
      },
    }));
    let answer: (groups: unknown) => void = () => undefined;
    stubStoryInvoke({
      project_scripts_scan: () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
      workspace_script_run_adhoc: 'run-next',
      process_ledger_list: [],
    });

    const pending = runPinnedScript({
      sessionId: SESSION.id,
      workspaceId: HARBORLINE.id,
      projectId: LEDGER.id,
      mountId: ROUNDING.mountId,
      pinId: devPin,
    });
    await vi.waitFor(() => expect(invokes('project_scripts_scan')).toHaveLength(1));
    useAppStore.setState({ currentSessionId: OTHER.id });
    answer([
      {
        source: 'package-json',
        packageName: 'ledger-core',
        relDir: '',
        manager: 'pnpm',
        scripts: [{ name: 'dev', command: 'pnpm run dev', body: 'vite' }],
      },
    ]);

    expect((await pending).kind).toBe('dropped');
    expect(invokes('workspace_script_run_adhoc')).toHaveLength(0);
  });

  it('opens the terminal on the branch page on screen, over the remembered worktree', () => {
    seed({ mounts: [SETTLEMENT, ROUNDING] });
    useAppStore.setState({
      activeLens: { [SESSION.id]: 'branch' },
      diffMountPath: { [SESSION.id]: ROUNDING.worktreePath },
      terminalScopes: { [SESSION.id]: SETTLEMENT.worktreePath },
    });

    toggleSessionTerminal({ sessionId: SESSION.id });

    const tabs = Object.values(useAppStore.getState().terminalTabs).flat();
    expect(tabs.map((tab) => tab.cwd)).toEqual([ROUNDING.worktreePath]);
  });
});

describe('where a script runs, two projects', () => {
  it('runs at once on the only branch of the script project', () => {
    seed({ mounts: [SETTLEMENT, WEBHOOKS] });

    expect(branchOf(outcomeOf({ projectId: LEDGER.id }))).toBe('hl/settlement');
    expect(branchOf(outcomeOf({ projectId: RELAY.id }))).toBe('hl/webhooks');
  });

  it('never runs a named mount elsewhere when it left the session', () => {
    seed({ mounts: [SETTLEMENT, WEBHOOKS] });

    expect(
      resolveScriptMount({
        state: useAppStore.getState(),
        sessionId: SESSION.id,
        projectId: LEDGER.id,
        mountId: ROUNDING.mountId,
      }).kind,
    ).toBe('none');
  });
});
