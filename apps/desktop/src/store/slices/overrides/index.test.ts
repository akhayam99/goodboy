// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  PlanId,
  OverrideSettings,
  PlanWithCount,
  ProviderPolicy,
  ProviderRunId,
  Session,
  SessionId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';

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
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
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
vi.mock('../../../features/scripts/scripts', async () =>
  (await import('../../storyHarness')).scriptsModuleMock(),
);
vi.mock('../../../features/terminal/terminal', async () =>
  (await import('../../storyHarness')).terminalModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

const WS_ID = 'workspace-1' as WorkspaceId;
const WS_ID_2 = 'workspace-2' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const SESSION_ID_2 = 'session-2' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const AGENT_ID_2 = 'agent-2' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const PLAN_ID = 'plan-1' as PlanId;
const NOW = '2026-05-28T00:00:00.000Z' as IsoDateTime;
const ANTHROPIC_ONLY: ProviderPolicy = [{ id: 'anthropic', state: 'on' }];
const POLICY: ProviderPolicy = [
  { id: 'codex', state: 'on' },
  { id: 'anthropic', state: 'on' },
  { id: 'cursor', state: 'backup' },
];

type PatchPayload = {
  readonly workspaceId: string;
  readonly patch: Partial<OverrideSettings>;
};

const isPatchPayload = (value: unknown): value is PatchPayload =>
  typeof value === 'object' && value !== null && 'patch' in value;

const PATCH_COMMAND = 'patch_workspace_overrides';

type Disk = {
  row: OverrideSettings;
  readonly patches: Array<Partial<OverrideSettings>>;
};

const diskHolding = ({ row }: { readonly row: OverrideSettings }): Disk => ({ row, patches: [] });

const writeToDisk = ({
  disk,
  patch,
}: {
  readonly disk: Disk;
  readonly patch: Partial<OverrideSettings>;
}): OverrideSettings => {
  disk.patches.push(patch);
  disk.row = { ...disk.row, ...patch };
  return disk.row;
};

function buildWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: WS_ID,
    name: 'ws',
    slug: 'ws',
    overrides: {
      defaultProviderId: null,
      defaultBranchPrefix: null,
      defaultVerbosity: null,
      providerBindings: null,
      taskModels: null,
      roleModels: null,
      parallelAgents: null,
      providerPool: null,
      attributionFooter: null,
      replyVoice: null,
      replyStyleNote: null,
      replyTemplateFixed: null,
      replyTemplateNoChange: null,
      resolveOnGithub: null,
      resolveCommitStyle: null,
      afterMerge: null,
      defaultBranchTemplate: null,
    },
    createdAt: NOW,
    updatedAt: NOW,
    lastAccessedAt: NOW,
    ...overrides,
  };
}

function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    workspaceId: WS_ID,
    goal: 'do a thing',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    autoRun: false,
    titleUserEdited: false,
    workflowRuns: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildAgent(overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent {
  return {
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent 1',
    status: 'pending',
    ...overrides,
  };
}

function buildPlan(overrides: Partial<PlanWithCount> = {}): PlanWithCount {
  return {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    title: 't',
    bodyMd: 'b',
    status: 'active',
    consumptionCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('store contract', () => {
  beforeEach(async () => {
    await resetStoryStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('overrides', () => {
    it('patchWorkspaceOverrides sends only the named keys and caches the row by workspace', async () => {
      const store = useAppStore;
      const { invoke } = await import('@tauri-apps/api/core');

      await store.getState().patchWorkspaceOverrides({
        workspaceId: WS_ID,
        patch: { defaultVerbosity: 'brief', providerPool: ANTHROPIC_ONLY },
      });

      expect(store.getState().workspaceOverrides[WS_ID]?.defaultVerbosity).toBe('brief');
      expect(store.getState().workspaceOverrides[WS_ID]?.providerPool).toEqual(ANTHROPIC_ONLY);
      expect(invoke).toHaveBeenCalledWith(PATCH_COMMAND, {
        workspaceId: WS_ID,
        patch: { defaultVerbosity: 'brief', providerPool: ANTHROPIC_ONLY },
      });
      const payload = vi.mocked(invoke).mock.calls[0]?.[1];
      expect(isPatchPayload(payload) ? payload.patch : null).not.toHaveProperty('enabledProviders');
      expect(isPatchPayload(payload) ? Object.keys(payload.patch) : []).toEqual([
        'defaultVerbosity',
        'providerPool',
      ]);
    });

    it('patchWorkspaceOverrides merges one key into the current row and keeps the others', async () => {
      const store = useAppStore;
      const base = buildWorkspace().overrides;
      store.setState({
        workspaceOverrides: {
          [WS_ID]: { ...base, defaultBranchPrefix: 'hb', providerPool: ANTHROPIC_ONLY },
        },
      });

      await store
        .getState()
        .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { parallelAgents: true } });

      expect(store.getState().workspaceOverrides[WS_ID]).toEqual({
        ...base,
        defaultBranchPrefix: 'hb',
        providerPool: ANTHROPIC_ONLY,
        parallelAgents: true,
      });
    });

    it('patchWorkspaceOverrides leaves untouched keys null instead of pinning resolved defaults', async () => {
      const store = useAppStore;

      await store
        .getState()
        .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { defaultBranchPrefix: 'nw' } });

      expect(store.getState().workspaceOverrides[WS_ID]).toEqual({
        ...buildWorkspace().overrides,
        defaultBranchPrefix: 'nw',
        workflowRules: null,
      });
    });

    it('patchWorkspaceOverrides reads the row at call time, so two quick edits both land', async () => {
      const store = useAppStore;

      await Promise.all([
        store
          .getState()
          .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { parallelAgents: true } }),
        store
          .getState()
          .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { attributionFooter: false } }),
      ]);

      expect(store.getState().workspaceOverrides[WS_ID]?.parallelAgents).toBe(true);
      expect(store.getState().workspaceOverrides[WS_ID]?.attributionFooter).toBe(false);
    });

    it('patchWorkspaceOverrides maps an undefined patch value to null', async () => {
      const store = useAppStore;
      store.setState({
        workspaceOverrides: {
          [WS_ID]: { ...buildWorkspace().overrides, providerPool: [{ id: 'codex', state: 'on' }] },
        },
      });

      await store
        .getState()
        .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { providerPool: undefined } });

      expect(store.getState().workspaceOverrides[WS_ID]?.providerPool).toBeNull();
    });

    it('setProviderPolicy moves the order and the default in one write', async () => {
      const store = useAppStore;
      const { invoke } = await import('@tauri-apps/api/core');

      await store.getState().setProviderPolicy({ workspaceId: WS_ID, policy: POLICY });

      const writes = vi.mocked(invoke).mock.calls.filter(([command]) => command === PATCH_COMMAND);
      expect(writes).toHaveLength(1);
      const payload = writes[0]?.[1];
      expect(isPatchPayload(payload) ? payload.patch.providerPool : null).toEqual(POLICY);
      expect(isPatchPayload(payload) ? payload.patch.defaultProviderId : null).toBe('codex');
    });

    it('setProviderPolicy writes null only on reset and keeps the default', async () => {
      const store = useAppStore;
      await store.getState().setProviderPolicy({ workspaceId: WS_ID, policy: POLICY });

      await store.getState().setProviderPolicy({ workspaceId: WS_ID, policy: null });

      expect(store.getState().workspaceOverrides[WS_ID]?.providerPool).toBeNull();
      expect(store.getState().workspaceOverrides[WS_ID]?.defaultProviderId).toBe('codex');
    });

    it('queues overlapping writes so the disk carries both changes and each write names only its own', async () => {
      const store = useAppStore;
      const { invoke } = await import('@tauri-apps/api/core');
      let releaseFirstWrite = (): void => undefined;
      const firstWrite = new Promise<void>((done) => {
        releaseFirstWrite = done;
      });
      const disk = diskHolding({ row: { ...buildWorkspace().overrides, workflowRules: null } });
      let writeCount = 0;
      vi.mocked(invoke).mockImplementation(async (command, args) => {
        if (command !== PATCH_COMMAND || !isPatchPayload(args)) {
          return null;
        }
        writeCount += 1;
        if (writeCount === 1) {
          await firstWrite;
        }
        return writeToDisk({ disk, patch: args.patch });
      });

      const policyWrite = store
        .getState()
        .setProviderPolicy({ workspaceId: WS_ID, policy: POLICY });
      const bindingWrite = store
        .getState()
        .setWorkspaceProviderBinding(WS_ID, 'anthropic', 'credential-harborline');
      releaseFirstWrite();
      await Promise.all([policyWrite, bindingWrite]);

      expect(disk.patches.map((patch) => Object.keys(patch).sort())).toEqual([
        ['defaultProviderId', 'providerPool'],
        ['providerBindings'],
      ]);
      expect(disk.row.providerPool).toEqual(POLICY);
      expect(disk.row.providerBindings).toEqual({ anthropic: 'credential-harborline' });
      expect(store.getState().workspaceOverrides[WS_ID]).toEqual(disk.row);
    });

    it('adopts the stored row the write returns, including a key another window saved', async () => {
      const store = useAppStore;
      const { invoke } = await import('@tauri-apps/api/core');
      const stale = buildWorkspace().overrides;
      store.setState({ workspaceOverrides: { [WS_ID]: stale } });
      const disk = diskHolding({ row: { ...stale, afterMerge: 'local' } });
      vi.mocked(invoke).mockImplementation(async (command, args) =>
        command === PATCH_COMMAND && isPatchPayload(args)
          ? writeToDisk({ disk, patch: args.patch })
          : null,
      );

      await store
        .getState()
        .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { defaultBranchPrefix: 'nw' } });

      expect(disk.patches).toEqual([{ defaultBranchPrefix: 'nw' }]);
      expect(store.getState().workspaceOverrides[WS_ID]?.afterMerge).toBe('local');
      expect(store.getState().workspaceOverrides[WS_ID]?.defaultBranchPrefix).toBe('nw');
    });

    it('loadWorkspaceOverrides reads a legacy list of names as a policy', async () => {
      const store = useAppStore;
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation(async (command) =>
        command === 'get_workspace_overrides'
          ? { ...buildWorkspace().overrides, providerPool: ['codex', 'anthropic'] }
          : null,
      );

      await store.getState().loadWorkspaceOverrides(WS_ID);

      const policy = store.getState().workspaceOverrides[WS_ID]?.providerPool ?? [];
      expect(policy.slice(0, 2)).toEqual([
        { id: 'codex', state: 'on' },
        { id: 'anthropic', state: 'on' },
      ]);
      expect(policy.slice(2).every((entry) => entry.state === 'off')).toBe(true);
    });

    it('patchWorkspaceOverrides rolls back when the write fails', async () => {
      const store = useAppStore;
      const previous = { ...buildWorkspace().overrides, defaultBranchPrefix: 'hb' };
      store.setState({ workspaceOverrides: { [WS_ID]: previous } });
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValueOnce(new Error('disk full'));

      await expect(
        store
          .getState()
          .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { defaultBranchPrefix: 'nw' } }),
      ).rejects.toThrow('disk full');

      expect(store.getState().workspaceOverrides[WS_ID]).toEqual(previous);
    });

    it('a refused value rolls the row back and surfaces the refusal', async () => {
      const store = useAppStore;
      const previous = { ...buildWorkspace().overrides, providerPool: ANTHROPIC_ONLY };
      store.setState({ workspaceOverrides: { [WS_ID]: previous } });
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValueOnce({
        kind: 'invalid_setting_value',
        message: 'providerPool does not accept this value',
      });

      await expect(
        store.getState().patchWorkspaceOverrides({
          workspaceId: WS_ID,
          patch: { providerPool: POLICY },
        }),
      ).rejects.toMatchObject({
        kind: 'invalid_setting_value',
        message: 'providerPool does not accept this value',
      });

      expect(store.getState().workspaceOverrides[WS_ID]).toEqual(previous);
    });

    it('a later queued write that fails leaves memory on what the disk holds', async () => {
      const store = useAppStore;
      const original = { ...buildWorkspace().overrides, defaultBranchPrefix: 'hb' };
      store.setState({ workspaceOverrides: { [WS_ID]: original } });
      const { invoke } = await import('@tauri-apps/api/core');
      let releaseFirstWrite = (): void => undefined;
      const firstWrite = new Promise<void>((done) => {
        releaseFirstWrite = done;
      });
      const disk = diskHolding({ row: original });
      let writeCount = 0;
      vi.mocked(invoke).mockImplementation(async (command, args) => {
        if (command !== PATCH_COMMAND || !isPatchPayload(args)) {
          return null;
        }
        writeCount += 1;
        if (writeCount === 1) {
          await firstWrite;
          return writeToDisk({ disk, patch: args.patch });
        }
        throw new Error('disk full');
      });

      const first = store
        .getState()
        .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { defaultBranchPrefix: 'nw' } });
      const second = store
        .getState()
        .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { parallelAgents: true } });
      releaseFirstWrite();
      await first;
      await expect(second).rejects.toThrow('disk full');

      expect(disk.row).toEqual({ ...original, defaultBranchPrefix: 'nw' });
      expect(store.getState().workspaceOverrides[WS_ID]).toEqual(disk.row);
    });

    it('two queued writes that both fail roll memory back to the last saved row', async () => {
      const store = useAppStore;
      const original = { ...buildWorkspace().overrides, defaultBranchPrefix: 'hb' };
      store.setState({ workspaceOverrides: { [WS_ID]: original } });
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation(async (command) => {
        if (command === PATCH_COMMAND) {
          throw new Error('disk full');
        }
        return null;
      });

      const first = store
        .getState()
        .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { defaultBranchPrefix: 'nw' } });
      const second = store
        .getState()
        .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { parallelAgents: true } });
      await expect(first).rejects.toThrow('disk full');
      await expect(second).rejects.toThrow('disk full');

      expect(store.getState().workspaceOverrides[WS_ID]).toEqual(original);
    });

    it('two queued writes to the same key that both fail leave the saved value, not the first attempt', async () => {
      const store = useAppStore;
      const original = { ...buildWorkspace().overrides, defaultBranchPrefix: 'hb' };
      store.setState({ workspaceOverrides: { [WS_ID]: original } });
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation(async (command) => {
        if (command === PATCH_COMMAND) {
          throw new Error('disk full');
        }
        return null;
      });

      const first = store
        .getState()
        .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { defaultBranchPrefix: 'nw' } });
      const second = store
        .getState()
        .patchWorkspaceOverrides({ workspaceId: WS_ID, patch: { defaultBranchPrefix: 'ac' } });
      await expect(first).rejects.toThrow('disk full');
      await expect(second).rejects.toThrow('disk full');

      expect(store.getState().workspaceOverrides[WS_ID]?.defaultBranchPrefix).toBe('hb');
    });
  });
});
