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
vi.mock('../../../features/onboarding/onboarding-store', async () =>
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

type OverridesPayload = {
  readonly workspaceId: string;
  readonly overrides: OverrideSettings;
};

const isOverridesPayload = (value: unknown): value is OverridesPayload =>
  typeof value === 'object' && value !== null && 'overrides' in value;

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
    it('setWorkspaceOverrides caches the override map keyed by workspace', async () => {
      const store = useAppStore;
      const overrides = {
        defaultVerbosity: 'brief',
        providerPool: ['anthropic', 'codex'],
      } as never;
      await store.getState().setWorkspaceOverrides(WS_ID, overrides);
      expect(store.getState().workspaceOverrides[WS_ID]?.defaultVerbosity).toBe('brief');
      expect(store.getState().workspaceOverrides[WS_ID]?.providerPool).toEqual([
        'anthropic',
        'codex',
      ]);
      const { invoke } = await import('@tauri-apps/api/core');
      expect(invoke).toHaveBeenCalledWith('set_workspace_overrides', {
        workspaceId: WS_ID,
        overrides,
      });
      const payload = vi.mocked(invoke).mock.calls[0]?.[1] as {
        readonly overrides: Record<string, unknown>;
      };
      expect(payload.overrides).toHaveProperty('providerPool', ['anthropic', 'codex']);
      expect(payload.overrides).not.toHaveProperty('enabledProviders');
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

      const writes = vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === 'set_workspace_overrides');
      expect(writes).toHaveLength(1);
      const payload = writes[0]?.[1];
      expect(isOverridesPayload(payload) ? payload.overrides.providerPool : null).toEqual(POLICY);
      expect(isOverridesPayload(payload) ? payload.overrides.defaultProviderId : null).toBe(
        'codex',
      );
    });

    it('setProviderPolicy writes null only on reset and keeps the default', async () => {
      const store = useAppStore;
      await store.getState().setProviderPolicy({ workspaceId: WS_ID, policy: POLICY });

      await store.getState().setProviderPolicy({ workspaceId: WS_ID, policy: null });

      expect(store.getState().workspaceOverrides[WS_ID]?.providerPool).toBeNull();
      expect(store.getState().workspaceOverrides[WS_ID]?.defaultProviderId).toBe('codex');
    });

    it('queues overlapping writes so the last one on disk carries both changes', async () => {
      const store = useAppStore;
      const { invoke } = await import('@tauri-apps/api/core');
      let releaseFirstWrite = (): void => undefined;
      const firstWrite = new Promise<void>((done) => {
        releaseFirstWrite = done;
      });
      const disk: Array<OverrideSettings> = [];
      let writeCount = 0;
      vi.mocked(invoke).mockImplementation(async (command, args) => {
        if (command !== 'set_workspace_overrides' || !isOverridesPayload(args)) {
          return null;
        }
        writeCount += 1;
        if (writeCount === 1) {
          await firstWrite;
        }
        disk.push(args.overrides);
        return null;
      });

      const policyWrite = store
        .getState()
        .setProviderPolicy({ workspaceId: WS_ID, policy: POLICY });
      const bindingWrite = store
        .getState()
        .setWorkspaceProviderBinding(WS_ID, 'anthropic', 'credential-harborline');
      releaseFirstWrite();
      await Promise.all([policyWrite, bindingWrite]);

      const last = disk.at(-1);
      expect(disk).toHaveLength(2);
      expect(last?.providerPool).toEqual(POLICY);
      expect(last?.providerBindings).toEqual({ anthropic: 'credential-harborline' });
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
  });
});
