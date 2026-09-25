import { describe, expect, it } from 'vitest';
import type {
  OverrideSettings,
  Project,
  ProjectId,
  ProviderId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../store';
import { resolveScopedSettings, selectResolvedSettings } from './selectResolvedSettings';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;
const PROJECT_ID = 'project-ledger-core' as ProjectId;
const SESSION_ID = 'session-1' as SessionId;

const NULL_OVERRIDE: OverrideSettings = {
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
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
};

type StateParams = {
  readonly workspace?: Partial<OverrideSettings>;
  readonly project?: Partial<OverrideSettings>;
  readonly session?: Partial<OverrideSettings>;
  readonly workspaceRow?: Record<string, unknown>;
};

const buildState = ({ workspace, project, session, workspaceRow }: StateParams): AppStore => {
  const sessionRow = {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    providerPreference: { defaultProvider: 'anthropic' as ProviderId, allowTurnOverride: true },
  } satisfies Partial<Session>;
  const projectRow = {
    id: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    overrides: { ...NULL_OVERRIDE, ...project },
  } satisfies Partial<Project>;
  const state = {
    sessions: [sessionRow],
    projects: [projectRow],
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    workspaceOverrides: {
      [WORKSPACE_ID]: workspaceRow ?? { ...NULL_OVERRIDE, ...workspace },
    },
    sessionOverrides:
      session === undefined ? {} : { [SESSION_ID]: { ...NULL_OVERRIDE, ...session } },
  };
  return state as unknown as AppStore;
};

describe('selectResolvedSettings', () => {
  it('lets the session row beat the active project and the project beat the workspace', () => {
    const workspaceRoles = {
      planner: {
        providerId: 'anthropic' as ProviderId,
        model: 'ws-model',
        effort: 'high' as const,
      },
    };
    const projectRoles = {
      planner: {
        providerId: 'codex' as ProviderId,
        model: 'project-model',
        effort: 'low' as const,
      },
    };
    const state = buildState({
      workspace: { roleModels: workspaceRoles, defaultVerbosity: 'brief' },
      project: { roleModels: projectRoles, defaultProviderId: 'codex' as ProviderId },
      session: { defaultProviderId: 'cursor' as ProviderId },
    });

    const settings = selectResolvedSettings({ state, sessionId: SESSION_ID });

    expect(settings?.roleModels).toBe(projectRoles);
    expect(settings?.defaultProviderId).toBe('cursor');
    expect(settings?.defaultProviderOverride).toBe('cursor');
    expect(settings?.defaultVerbosityOverride).toBe('brief');
  });

  it('merges bindings from every scope, the closest one winning per provider', () => {
    const state = buildState({
      workspace: { providerBindings: { anthropic: 'ws-cred', codex: 'ws-codex' } },
      project: { providerBindings: { codex: 'project-codex' } },
      session: { providerBindings: { anthropic: 'session-cred' } },
    });

    const settings = selectResolvedSettings({ state, sessionId: SESSION_ID });

    expect(settings?.providerBindings).toEqual({
      anthropic: 'session-cred',
      codex: 'project-codex',
    });
  });

  it('leaves the explicit provider and verbosity unset when no scope names one', () => {
    const settings = selectResolvedSettings({ state: buildState({}), sessionId: SESSION_ID });

    expect(settings?.defaultProviderId).toBe('anthropic');
    expect(settings?.defaultProviderOverride).toBeNull();
    expect(settings?.defaultVerbosity).toBe('normal');
    expect(settings?.defaultVerbosityOverride).toBeNull();
  });

  it('resolves an explicit parallel agents false and an absent key identically', () => {
    const { parallelAgents: _omitted, ...withoutKey } = NULL_OVERRIDE;
    const explicit = selectResolvedSettings({
      state: buildState({ workspaceRow: { ...NULL_OVERRIDE, parallelAgents: false } }),
      sessionId: SESSION_ID,
    });
    const absent = selectResolvedSettings({
      state: buildState({ workspaceRow: withoutKey }),
      sessionId: SESSION_ID,
    });

    expect(explicit?.parallelAgents).toBe(false);
    expect(absent?.parallelAgents).toBe(explicit?.parallelAgents);
  });

  it('returns null for an unknown or missing session', () => {
    const state = buildState({});

    expect(selectResolvedSettings({ state, sessionId: 'missing' as SessionId })).toBeNull();
    expect(selectResolvedSettings({ state, sessionId: null })).toBeNull();
  });

  it('resolves workspace and project alone before a session row exists', () => {
    const state = buildState({
      workspace: { defaultVerbosity: 'brief' },
      project: { defaultVerbosity: 'verbose' },
    });

    const settings = resolveScopedSettings({
      state,
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      sessionId: null,
      defaultProviderId: 'anthropic' as ProviderId,
    });

    expect(settings.defaultVerbosityOverride).toBe('verbose');
  });
});
