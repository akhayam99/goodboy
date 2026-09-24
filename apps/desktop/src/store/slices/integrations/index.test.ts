// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import type {
  Agent,
  AgentId,
  IntegrationCredential,
  IntegrationCredentialId,
  IsoDateTime,
  PlanId,
  PlanWithCount,
  Project,
  ProjectId,
  ProviderRunId,
  Session,
  SessionId,
  Workspace,
  WorkspaceId,
  IntegrationBinding,
  IntegrationBindingId,
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
vi.mock('../../../shared/lib/ls-to-db-migration', async () =>
  (await import('../../storyHarness')).lsToDbMigrationModuleMock(),
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
vi.mock('../../../features/integrations/sentry/client', async () =>
  (await import('../../storyHarness')).sentryClientModuleMock(),
);
vi.mock('../../../features/integrations/gitlab/client', async () =>
  (await import('../../storyHarness')).gitlabClientModuleMock(),
);
vi.mock('../../../features/integrations/jira/client', async () =>
  (await import('../../storyHarness')).jiraClientModuleMock(),
);
vi.mock('../../../features/integrations/slack/client', async () =>
  (await import('../../storyHarness')).slackClientModuleMock(),
);
vi.mock('../../../features/github/github', async () =>
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
vi.mock('../../../features/context/components/QuestionsTab/useOpenQuestions', async () =>
  (await import('../../storyHarness')).openQuestionsModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

const WS_ID = 'workspace-1' as WorkspaceId;
const WS_ID_2 = 'workspace-2' as WorkspaceId;
const PROJECT_ID = 'project-1' as ProjectId;
const SESSION_ID = 'session-1' as SessionId;
const SESSION_ID_2 = 'session-2' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const AGENT_ID_2 = 'agent-2' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const PLAN_ID = 'plan-1' as PlanId;
const NOW = '2026-05-28T00:00:00.000Z' as IsoDateTime;

function buildWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: WS_ID,
    name: 'ws',
    slug: 'ws',
    overrides: {
      defaultProviderId: null,
      defaultWorkflowId: null,
      defaultBranchPrefix: null,
      parallelEnabled: null,
      defaultVerbosity: null,
      providerBindings: null,
      taskModels: null,
      roleModels: null,
      parallelAgents: null,
      providerPool: null,
      attributionFooter: null,
    },
    createdAt: NOW,
    updatedAt: NOW,
    lastAccessedAt: NOW,
    ...overrides,
  };
}

const buildProject = (): Project => ({
  id: PROJECT_ID,
  workspaceId: WS_ID,
  name: 'repo',
  rootPath: '/tmp/repo',
  kind: 'repo',
  overrides: buildWorkspace().overrides,
  createdAt: NOW,
  updatedAt: NOW,
});

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
    useAppStore.setState({ projects: [buildProject()] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  describe('integrations', () => {
    const CRED_ID = 'cred-1' as IntegrationCredentialId;

    const linearRow = (): IntegrationBinding => ({
      id: 'i-1' as IntegrationBindingId,
      workspaceId: WS_ID,
      projectId: null,
      provider: 'linear',
      config: { workspaceUrlKey: 'k', viewerUserId: 'u', viewerName: 'n' },
      credentialId: CRED_ID,
      createdAt: NOW,
      updatedAt: NOW,
    });

    it('loadIntegrations caches rows keyed by workspaceId', async () => {
      const store = useAppStore;
      const integ = linearRow();
      storySpies.listIntegrationBindingsForWorkspace.mockResolvedValueOnce([integ]);
      await store.getState().loadIntegrations(WS_ID);
      expect(store.getState().workspaceIntegrations[WS_ID]).toEqual([integ]);
    });

    it('loadIntegrationCredentials caches the global keys and how many projects hold each', async () => {
      const store = useAppStore;
      const credential: IntegrationCredential = {
        id: CRED_ID,
        provider: 'linear',
        label: 'tester',
        account: 'linear.app/org',
        createdAt: NOW,
        updatedAt: NOW,
      };
      storySpies.listIntegrationCredentials.mockResolvedValueOnce([credential]);
      storySpies.countWorkspacesPerIntegrationCredential.mockResolvedValueOnce({ [CRED_ID]: 2 });

      await store.getState().loadIntegrationCredentials();

      expect(store.getState().integrationCredentials).toEqual([credential]);
      expect(store.getState().integrationCredentialUsage).toEqual({ [CRED_ID]: 2 });
    });

    it('connectLinear writes a credential of its own and points the workspace row at it', async () => {
      const store = useAppStore;
      storySpies.linearValidateConnection.mockResolvedValueOnce({
        id: 'viewer-1',
        name: 'tester',
        organization: { urlKey: 'org' },
      });
      const out = await store
        .getState()
        .connectLinear({ workspaceId: WS_ID, token: 'tok', credentialId: null });
      expect(out.id).toBe('viewer-1');
      expect(storySpies.upsertIntegrationCredential).toHaveBeenCalledTimes(1);
      expect(storySpies.upsertIntegrationBinding).toHaveBeenCalledTimes(1);
      const cached = store.getState().workspaceIntegrations[WS_ID];
      const linear = cached?.find((i) => i.provider === 'linear');
      expect(linear?.credentialId).toBeDefined();
      expect(linear?.credentialId).not.toBe(`goodboy.workspace.${WS_ID}.linear`);
      const stored = store.getState().integrationCredentials[0];
      expect(stored?.label).toBe('tester');
      expect(stored?.account).toBe('linear.app/org');
    });

    it('connectLinear on a chosen credential sends no token across the boundary and writes no second credential', async () => {
      const store = useAppStore;
      storySpies.linearValidateConnection.mockResolvedValueOnce({
        id: 'viewer-1',
        name: 'tester',
        organization: { urlKey: 'org' },
      });

      await store
        .getState()
        .connectLinear({ workspaceId: WS_ID, token: 'ignored', credentialId: CRED_ID });

      expect(storySpies.linearValidateConnection).toHaveBeenCalledWith(CRED_ID, null);
      expect(storySpies.linearConnect).toHaveBeenCalledWith(CRED_ID, null);
      expect(storySpies.upsertIntegrationCredential).not.toHaveBeenCalled();
      const linear = store
        .getState()
        .workspaceIntegrations[WS_ID]?.find((i) => i.provider === 'linear');
      expect(linear?.credentialId).toBe(CRED_ID);
    });

    it('disconnectIntegration drops the workspace row and never touches the key', async () => {
      const store = useAppStore;
      store.setState({ workspaceIntegrations: { [WS_ID]: [linearRow()] } });

      await store.getState().disconnectIntegration({ workspaceId: WS_ID, provider: 'linear' });

      expect(storySpies.deleteIntegrationBindingsForProvider).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: WS_ID, provider: 'linear' }),
      );
      expect(storySpies.deleteIntegrationCredential).not.toHaveBeenCalled();
      expect(store.getState().workspaceIntegrations[WS_ID]).toEqual([]);
    });

    it('disconnectIntegration leaves the other providers of the workspace alone', async () => {
      const store = useAppStore;
      const sentry: IntegrationBinding = {
        id: 'sentry-1' as IntegrationBindingId,
        workspaceId: WS_ID,
        projectId: null,
        provider: 'sentry',
        config: { org: 'goodboy', project: 'desktop' },
        credentialId: 'cred-sentry' as IntegrationCredentialId,
        createdAt: NOW,
        updatedAt: NOW,
      };
      const linear = linearRow();
      store.setState({ workspaceIntegrations: { [WS_ID]: [linear, sentry] } });

      await store.getState().disconnectIntegration({ workspaceId: WS_ID, provider: 'sentry' });

      expect(store.getState().workspaceIntegrations[WS_ID]).toEqual([linear]);
    });

    it('forgetIntegrationCredential refuses while another project still holds the key', async () => {
      const store = useAppStore;
      store.setState({ integrationCredentialUsage: { [CRED_ID]: 1 } });

      await expect(
        store.getState().forgetIntegrationCredential({ credentialId: CRED_ID }),
      ).rejects.toThrow(/still uses this key/);

      expect(storySpies.deleteIntegrationCredential).not.toHaveBeenCalled();
    });

    it('forgetIntegrationCredential removes the row and the secret once nothing references it', async () => {
      const store = useAppStore;
      const credential: IntegrationCredential = {
        id: CRED_ID,
        provider: 'linear',
        label: 'tester',
        account: 'linear.app/org',
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({ integrationCredentials: [credential], integrationCredentialUsage: {} });

      await store.getState().forgetIntegrationCredential({ credentialId: CRED_ID });

      expect(storySpies.deleteIntegrationCredential).toHaveBeenCalledWith(
        expect.anything(),
        CRED_ID,
      );
      expect(store.getState().integrationCredentials).toEqual([]);
    });

    it('connectSentry derives the project config and labels the credential by organization', async () => {
      const store = useAppStore;
      storySpies.sentryValidateConnection.mockResolvedValueOnce({
        slug: 'desktop',
        name: 'Desktop',
        organization: { slug: 'goodboy', name: 'Goodboy' },
      });
      const out = await store.getState().connectSentry({
        workspaceId: WS_ID,
        token: 'tok',
        org: 'goodboy',
        project: 'desktop',
        credentialId: null,
      });
      expect(out.slug).toBe('desktop');
      expect(storySpies.sentryValidateConnection).toHaveBeenCalledWith(
        expect.any(String),
        'tok',
        'goodboy',
        'desktop',
      );
      const sentry = store
        .getState()
        .workspaceIntegrations[WS_ID]?.find((i) => i.provider === 'sentry');
      expect(sentry?.config).toEqual({
        org: 'goodboy',
        project: 'desktop',
        projectName: 'Desktop',
        orgName: 'Goodboy',
      });
      expect(store.getState().integrationCredentials[0]?.account).toBe('goodboy');
    });

    it('connectSentry reuses an existing row id and createdAt on reconnect', async () => {
      const store = useAppStore;
      const existing: IntegrationBinding = {
        id: 'sentry-old' as IntegrationBindingId,
        workspaceId: WS_ID,
        projectId: null,
        provider: 'sentry',
        config: { org: 'goodboy', project: 'old', projectName: 'Old' },
        credentialId: CRED_ID,
        createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      };
      storySpies.getIntegrationBinding.mockResolvedValueOnce(existing);
      store.setState({ workspaceIntegrations: { [WS_ID]: [existing] } });
      storySpies.sentryValidateConnection.mockResolvedValueOnce({
        slug: 'new',
        name: 'New',
        organization: { slug: 'goodboy', name: 'Goodboy' },
      });
      await store.getState().connectSentry({
        workspaceId: WS_ID,
        token: 'tok',
        org: 'goodboy',
        project: 'new',
        credentialId: CRED_ID,
      });
      const rows = (store.getState().workspaceIntegrations[WS_ID] ?? []).filter(
        (i) => i.provider === 'sentry',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe('sentry-old');
      expect(rows[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect((rows[0]?.config as { project: string }).project).toBe('new');
    });

    it('connectSentry preserves a coexisting linear row', async () => {
      const store = useAppStore;
      store.setState({ workspaceIntegrations: { [WS_ID]: [linearRow()] } });
      storySpies.sentryValidateConnection.mockResolvedValueOnce({
        slug: 'desktop',
        name: 'Desktop',
        organization: { slug: 'goodboy', name: 'Goodboy' },
      });
      await store.getState().connectSentry({
        workspaceId: WS_ID,
        token: 'tok',
        org: 'goodboy',
        project: 'desktop',
        credentialId: null,
      });
      const providers = (store.getState().workspaceIntegrations[WS_ID] ?? [])
        .map((i) => i.provider)
        .sort();
      expect(providers).toEqual(['linear', 'sentry']);
    });

    it('connectSentry propagates a backend error and leaves cache untouched', async () => {
      const store = useAppStore;
      storySpies.sentryValidateConnection.mockRejectedValueOnce(new Error('invalid token'));
      await expect(
        store.getState().connectSentry({
          workspaceId: WS_ID,
          token: 'bad',
          org: 'goodboy',
          project: 'desktop',
          credentialId: null,
        }),
      ).rejects.toThrow('invalid token');
      expect(storySpies.upsertIntegrationBinding).not.toHaveBeenCalled();
      expect(storySpies.upsertIntegrationCredential).not.toHaveBeenCalled();
      expect(store.getState().workspaceIntegrations[WS_ID]).toBeUndefined();
    });

    it('connectGitlab carries host into the config and labels the credential by host', async () => {
      const store = useAppStore;
      storySpies.gitlabValidateConnection.mockResolvedValueOnce({
        id: 99,
        username: 'amin',
        name: 'Amin K',
      });
      const out = await store.getState().connectGitlab({
        workspaceId: WS_ID,
        host: 'https://gitlab.example.com',
        token: 'tok',
        credentialId: null,
      });
      expect(out.id).toBe(99);
      expect(storySpies.gitlabValidateConnection).toHaveBeenCalledWith(
        expect.any(String),
        'https://gitlab.example.com',
        'tok',
      );
      const cached = store
        .getState()
        .workspaceIntegrations[WS_ID]?.find((i) => i.provider === 'gitlab');
      expect(cached?.config).toEqual({
        userName: 'Amin K',
        userId: '99',
        host: 'https://gitlab.example.com',
      });
      expect(store.getState().integrationCredentials[0]?.account).toBe(
        'https://gitlab.example.com',
      );
    });

    it('connectGitlab preserves id + createdAt and refreshes host on reconnect', async () => {
      const store = useAppStore;
      const existing: IntegrationBinding = {
        id: 'gl-keep' as IntegrationBindingId,
        workspaceId: WS_ID,
        projectId: null,
        provider: 'gitlab',
        config: { userName: 'old', userId: '1', host: 'https://gitlab.com' },
        credentialId: CRED_ID,
        createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      };
      storySpies.getIntegrationBinding.mockResolvedValueOnce(existing);
      store.setState({ workspaceIntegrations: { [WS_ID]: [existing] } });
      storySpies.gitlabValidateConnection.mockResolvedValueOnce({
        id: 2,
        username: 'amin',
        name: 'Amin K',
      });
      await store.getState().connectGitlab({
        workspaceId: WS_ID,
        host: 'https://self.hosted',
        token: 'tok2',
        credentialId: CRED_ID,
      });
      const gitlab = (store.getState().workspaceIntegrations[WS_ID] ?? []).filter(
        (i) => i.provider === 'gitlab',
      );
      expect(gitlab).toHaveLength(1);
      expect(gitlab[0]?.id).toBe('gl-keep');
      expect(gitlab[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(gitlab[0]?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
      expect((gitlab[0]?.config as { host: string }).host).toBe('https://self.hosted');
    });

    it('connectJira caches the site, project and account details it validated', async () => {
      const store = useAppStore;
      storySpies.jiraValidateConnection.mockResolvedValueOnce({
        accountId: 'acc-7',
        displayName: 'Grace Hopper',
      });
      const out = await store.getState().connectJira({
        workspaceId: WS_ID,
        siteUrl: 'https://acme.atlassian.net',
        email: 'grace@acme.com',
        projectKey: 'ENG',
        apiToken: 'ATATT-x',
        credentialId: null,
      });
      expect(out.accountId).toBe('acc-7');
      const cached = store
        .getState()
        .workspaceIntegrations[WS_ID]?.find((i) => i.provider === 'jira');
      expect(cached?.config).toEqual({
        accountId: 'acc-7',
        displayName: 'Grace Hopper',
        siteUrl: 'https://acme.atlassian.net',
        email: 'grace@acme.com',
        projectKey: 'ENG',
      });
      expect(store.getState().integrationCredentials[0]?.account).toBe('grace@acme.com');
    });

    it('connectJira keeps the row identity and refreshes the project on reconnect', async () => {
      const store = useAppStore;
      const existing: IntegrationBinding = {
        id: 'ji-keep' as IntegrationBindingId,
        workspaceId: WS_ID,
        projectId: null,
        provider: 'jira',
        config: {
          siteUrl: 'https://acme.atlassian.net',
          email: 'grace@acme.com',
          projectKey: 'OLD',
        },
        credentialId: CRED_ID,
        createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      };
      storySpies.getIntegrationBinding.mockResolvedValueOnce(existing);
      store.setState({ workspaceIntegrations: { [WS_ID]: [existing] } });
      storySpies.jiraValidateConnection.mockResolvedValueOnce({
        accountId: 'acc-7',
        displayName: 'Grace Hopper',
      });
      await store.getState().connectJira({
        workspaceId: WS_ID,
        siteUrl: 'https://acme.atlassian.net',
        email: 'grace@acme.com',
        projectKey: 'ENG',
        apiToken: null,
        credentialId: CRED_ID,
      });
      const rows = (store.getState().workspaceIntegrations[WS_ID] ?? []).filter(
        (i) => i.provider === 'jira',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe('ji-keep');
      expect(rows[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect((rows[0]?.config as { projectKey: string }).projectKey).toBe('ENG');
    });

    it('connectSlack probes the token, stores it, then caches the team it answered with', async () => {
      const store = useAppStore;
      storySpies.slackValidateConnection.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });

      const out = await store
        .getState()
        .connectSlack({ workspaceId: WS_ID, botToken: ' xoxp-secret ', credentialId: null });

      expect(out.teamId).toBe('T01');
      expect(storySpies.slackValidateConnection).toHaveBeenCalledWith({
        credentialId: expect.any(String),
        botToken: ' xoxp-secret ',
      });
      const cached = store
        .getState()
        .workspaceIntegrations[WS_ID]?.find((i) => i.provider === 'slack');
      expect(cached?.config).toEqual({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });
      expect(cached?.credentialId).toBeDefined();
    });

    it('connectSlack writes the database row before the keychain, so a failure between them never orphans a live token', async () => {
      const store = useAppStore;
      storySpies.slackValidateConnection.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });

      await store
        .getState()
        .connectSlack({ workspaceId: WS_ID, botToken: 'xoxp-secret', credentialId: null });

      const dbCallOrder = storySpies.upsertIntegrationBinding.mock.invocationCallOrder[0];
      const keychainCallOrder = storySpies.slackConnect.mock.invocationCallOrder[0];
      expect(dbCallOrder).toBeDefined();
      expect(keychainCallOrder).toBeDefined();
      expect(dbCallOrder as number).toBeLessThan(keychainCallOrder as number);
    });

    it('connectSlack rolls back both fresh rows when the keychain write fails', async () => {
      const store = useAppStore;
      storySpies.slackValidateConnection.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });
      storySpies.slackConnect.mockRejectedValueOnce(new Error('keychain unavailable'));

      await expect(
        store
          .getState()
          .connectSlack({ workspaceId: WS_ID, botToken: 'xoxp-secret', credentialId: null }),
      ).rejects.toThrow(/keychain unavailable/);

      expect(storySpies.upsertIntegrationBinding).toHaveBeenCalledTimes(1);
      expect(storySpies.deleteIntegrationBinding).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: WS_ID, provider: 'slack', projectId: null }),
      );
      expect(storySpies.deleteIntegrationCredential).toHaveBeenCalledTimes(1);
      expect(store.getState().workspaceIntegrations[WS_ID] ?? []).toEqual([]);
    });

    it('connectSlack restores the database row when the in-memory store is stale', async () => {
      const store = useAppStore;
      const existing: IntegrationBinding = {
        id: 'sl-db-existing' as IntegrationBindingId,
        workspaceId: WS_ID,
        projectId: null,
        provider: 'slack',
        config: { teamId: 'T00', teamName: 'Old', botUserId: 'U00' },
        credentialId: CRED_ID,
        createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      };
      storySpies.getIntegrationBinding.mockResolvedValueOnce(existing);
      storySpies.slackValidateConnection.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'NewTeam',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });
      storySpies.slackConnect.mockRejectedValueOnce(new Error('keychain unavailable'));

      await expect(
        store
          .getState()
          .connectSlack({ workspaceId: WS_ID, botToken: 'xoxp-new', credentialId: CRED_ID }),
      ).rejects.toThrow(/keychain unavailable/);

      expect(storySpies.deleteIntegrationBinding).not.toHaveBeenCalled();
      expect(storySpies.deleteIntegrationCredential).not.toHaveBeenCalled();
      expect(storySpies.upsertIntegrationBinding).toHaveBeenLastCalledWith(
        expect.objectContaining({ binding: existing }),
      );
    });

    it('connectSlack preserves the keychain error when database rollback fails', async () => {
      const store = useAppStore;
      storySpies.slackValidateConnection.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });
      storySpies.slackConnect.mockRejectedValueOnce(new Error('keychain unavailable'));
      storySpies.deleteIntegrationBinding.mockRejectedValueOnce(new Error('rollback failed'));

      await expect(
        store
          .getState()
          .connectSlack({ workspaceId: WS_ID, botToken: 'xoxp-secret', credentialId: null }),
      ).rejects.toThrow(/keychain unavailable/);
    });

    it('connectSlack never stores a token the probe rejected', async () => {
      const store = useAppStore;
      storySpies.slackValidateConnection.mockRejectedValueOnce(new Error('invalid_auth'));

      await expect(
        store
          .getState()
          .connectSlack({ workspaceId: WS_ID, botToken: 'xoxp-bad', credentialId: null }),
      ).rejects.toThrow(/invalid_auth/);

      expect(storySpies.slackConnect).not.toHaveBeenCalled();
      expect(storySpies.upsertIntegrationBinding).not.toHaveBeenCalled();
      expect(store.getState().workspaceIntegrations[WS_ID] ?? []).toEqual([]);
    });

    it('connectSlack keeps the row identity when the same workspace reconnects', async () => {
      const store = useAppStore;
      const existing: IntegrationBinding = {
        id: 'sl-keep' as IntegrationBindingId,
        workspaceId: WS_ID,
        projectId: null,
        provider: 'slack',
        config: { teamId: 'T00', teamName: 'Old', botUserId: 'U00' },
        credentialId: CRED_ID,
        createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      };
      storySpies.getIntegrationBinding.mockResolvedValueOnce(existing);
      store.setState({ workspaceIntegrations: { [WS_ID]: [existing] } });
      storySpies.slackValidateConnection.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });

      await store
        .getState()
        .connectSlack({ workspaceId: WS_ID, botToken: 'xoxp-secret', credentialId: CRED_ID });

      const rows = (store.getState().workspaceIntegrations[WS_ID] ?? []).filter(
        (i) => i.provider === 'slack',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe('sl-keep');
      expect(rows[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect((rows[0]?.config as { teamName: string }).teamName).toBe('Acme');
    });

    it('resolveBinding prefers the project override over the workspace binding', async () => {
      const store = useAppStore;
      const workspaceLevel = linearRow();
      const override: IntegrationBinding = {
        ...linearRow(),
        id: 'i-override' as IntegrationBindingId,
        projectId: PROJECT_ID,
        credentialId: 'cred-override' as IntegrationCredentialId,
      };
      store.setState({ workspaceIntegrations: { [WS_ID]: [workspaceLevel, override] } });

      const resolved = store
        .getState()
        .resolveBinding({ workspaceId: WS_ID, provider: 'linear', projectId: PROJECT_ID });
      expect(resolved?.id).toBe('i-override');

      const fallback = store.getState().resolveBinding({ workspaceId: WS_ID, provider: 'linear' });
      expect(fallback?.id).toBe('i-1');
    });

    it('resolveBinding falls back to the workspace binding for a project with no override', async () => {
      const store = useAppStore;
      store.setState({ workspaceIntegrations: { [WS_ID]: [linearRow()] } });

      const resolved = store.getState().resolveBinding({
        workspaceId: WS_ID,
        provider: 'linear',
        projectId: 'project-elsewhere' as ProjectId,
      });
      expect(resolved?.id).toBe('i-1');

      const missing = store.getState().resolveBinding({ workspaceId: WS_ID, provider: 'slack' });
      expect(missing).toBeNull();
    });

    it('disconnectGithub clears the workspace-scoped keychain token only', async () => {
      const store = useAppStore;

      await store.getState().disconnectGithub({ workspaceId: WS_ID });

      expect(storySpies.ghClearToken).toHaveBeenCalledWith(WS_ID);
      expect(storySpies.deleteIntegrationBinding).not.toHaveBeenCalled();
      expect(storySpies.deleteIntegrationBindingsForProvider).not.toHaveBeenCalled();
    });
  });
});
