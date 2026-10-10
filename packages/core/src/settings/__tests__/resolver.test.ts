import { describe, it, expect } from 'vitest';
import { resolveSettings } from '../resolver';
import type { GlobalSettings, OverrideSettings } from '@goodboy/types';
import type { WorkflowId } from '@goodboy/types';
import type { ProviderId } from '@goodboy/types';

const GLOBAL: GlobalSettings = {
  defaultProviderId: 'anthropic' as ProviderId,
  defaultWorkflowId: null,
  defaultBranchPrefix: 'kay',
  parallelEnabled: false,
  defaultVerbosity: 'normal',
};

const NULL_OVERRIDE: OverrideSettings = {
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
  workflowRules: null,
};

describe('resolveSettings', () => {
  it('null/null/null → global only', () => {
    const result = resolveSettings({ global: GLOBAL });
    expect(result.defaultProviderId).toBe('anthropic');
    expect(result.defaultBranchPrefix).toBe('kay');
    expect(result.parallelEnabled).toBe(false);
    expect(result.defaultWorkflowId).toBeNull();
  });

  it('null/value/null → workspace wins', () => {
    const wsOverride: OverrideSettings = {
      defaultProviderId: 'cursor' as ProviderId,
      defaultBranchPrefix: 'ws-prefix',
      defaultVerbosity: 'verbose',
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
      workflowRules: null,
    };
    const result = resolveSettings({ global: GLOBAL, workspaceOverride: wsOverride });
    expect(result.defaultProviderId).toBe('cursor');
    expect(result.defaultBranchPrefix).toBe('ws-prefix');
    expect(result.defaultVerbosity).toBe('verbose');
  });

  it('null/null/value (session) → session wins for provider/prefix; session.defaultVerbosity always null in production', () => {
    const sessOverride: OverrideSettings = {
      defaultProviderId: 'codex' as ProviderId,
      defaultBranchPrefix: 'sess-prefix',
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
      workflowRules: null,
    };
    const result = resolveSettings({ global: GLOBAL, sessionOverride: sessOverride });
    expect(result.defaultProviderId).toBe('codex');
    expect(result.defaultBranchPrefix).toBe('sess-prefix');
    expect(result.defaultVerbosity).toBe('normal');
  });

  it('session overrides win over workspace for non-verbosity fields', () => {
    const wsOverride: OverrideSettings = {
      defaultProviderId: 'cursor' as ProviderId,
      defaultBranchPrefix: 'ws-prefix',
      defaultVerbosity: 'verbose',
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
      workflowRules: null,
    };
    const sessOverride: OverrideSettings = {
      defaultProviderId: 'codex' as ProviderId,
      defaultBranchPrefix: 'sess-prefix',
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
      workflowRules: null,
    };
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: wsOverride,
      sessionOverride: sessOverride,
    });
    expect(result.defaultProviderId).toBe('codex');
    expect(result.defaultBranchPrefix).toBe('sess-prefix');
    expect(result.defaultVerbosity).toBe('verbose');
  });

  it('resolves session then project then workspace then global', () => {
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, defaultBranchPrefix: 'workspace' },
      projectOverride: { ...NULL_OVERRIDE, defaultBranchPrefix: 'project' },
    });
    expect(result.defaultBranchPrefix).toBe('project');

    const sessionResult = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, defaultBranchPrefix: 'workspace' },
      projectOverride: { ...NULL_OVERRIDE, defaultBranchPrefix: 'project' },
      sessionOverride: { ...NULL_OVERRIDE, defaultBranchPrefix: 'session' },
    });
    expect(sessionResult.defaultBranchPrefix).toBe('session');
  });

  it('null-fields session falls back to workspace', () => {
    const wsOverride: OverrideSettings = {
      defaultProviderId: 'cursor' as ProviderId,
      defaultBranchPrefix: 'ws-prefix',
      defaultVerbosity: 'verbose',
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
      workflowRules: null,
    };
    const sessOverride: OverrideSettings = {
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
      workflowRules: null,
    };
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: wsOverride,
      sessionOverride: sessOverride,
    });
    expect(result.defaultProviderId).toBe('cursor');
    expect(result.defaultBranchPrefix).toBe('ws-prefix');
    expect(result.defaultVerbosity).toBe('verbose');
  });

  it('all-null overrides → global used everywhere', () => {
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: NULL_OVERRIDE,
      sessionOverride: NULL_OVERRIDE,
    });
    expect(result.defaultProviderId).toBe('anthropic');
    expect(result.defaultBranchPrefix).toBe('kay');
    expect(result.parallelEnabled).toBe(false);
    expect(result.defaultVerbosity).toBe('normal');
  });

  it('undefined overrides treated same as null overrides', () => {
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: undefined,
      sessionOverride: undefined,
    });
    expect(result.defaultProviderId).toBe('anthropic');
    expect(result.defaultBranchPrefix).toBe('kay');
  });

  it('global with non-null workflowId is inherited when overrides are null', () => {
    const globalWithTemplate: GlobalSettings = {
      ...GLOBAL,
      defaultWorkflowId: 'global-tpl' as WorkflowId,
    };
    const result = resolveSettings({ global: globalWithTemplate });
    expect(result.defaultWorkflowId).toBe('global-tpl');
  });

  it('verbosity: global normal when no overrides', () => {
    const result = resolveSettings({ global: GLOBAL });
    expect(result.defaultVerbosity).toBe('normal');
  });

  it('verbosity: workspace brief overrides global normal', () => {
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, defaultVerbosity: 'brief' },
    });
    expect(result.defaultVerbosity).toBe('brief');
  });

  it('verbosity: workspace verbose overrides global normal', () => {
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, defaultVerbosity: 'verbose' },
    });
    expect(result.defaultVerbosity).toBe('verbose');
  });

  it('verbosity: session.defaultVerbosity always null → workspace wins', () => {
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, defaultVerbosity: 'verbose' },
      sessionOverride: { ...NULL_OVERRIDE, defaultVerbosity: null },
    });
    expect(result.defaultVerbosity).toBe('verbose');
  });

  it('verbosity: session null + workspace null → global', () => {
    const globalVerbose: GlobalSettings = { ...GLOBAL, defaultVerbosity: 'verbose' };
    const result = resolveSettings({
      global: globalVerbose,
      workspaceOverride: NULL_OVERRIDE,
      sessionOverride: NULL_OVERRIDE,
    });
    expect(result.defaultVerbosity).toBe('verbose');
  });

  it('verbosity: workspace null falls back to global brief', () => {
    const globalBrief: GlobalSettings = { ...GLOBAL, defaultVerbosity: 'brief' };
    const result = resolveSettings({
      global: globalBrief,
      workspaceOverride: NULL_OVERRIDE,
      sessionOverride: NULL_OVERRIDE,
    });
    expect(result.defaultVerbosity).toBe('brief');
  });

  it('role and task models: session beats project beats workspace', () => {
    const wsRoles = {
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
    const sessionTasks = {
      summarizer: { providerId: 'cursor' as ProviderId, model: 'sess-model' },
    };
    const wsTasks = { summarizer: { providerId: 'anthropic' as ProviderId, model: 'ws-task' } };
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, roleModels: wsRoles, taskModels: wsTasks },
      projectOverride: { ...NULL_OVERRIDE, roleModels: projectRoles },
      sessionOverride: { ...NULL_OVERRIDE, taskModels: sessionTasks },
    });
    expect(result.roleModels).toEqual(projectRoles);
    expect(result.taskModels).toEqual(sessionTasks);
  });

  it('task models: a project that pins one task keeps the workspace pins of the others', () => {
    const workspaceTasks = {
      workflow_orchestrator: { providerId: 'anthropic' as ProviderId, model: 'claude-sonnet-5-5' },
      summarizer: { providerId: 'anthropic' as ProviderId, model: 'claude-sonnet-5-5' },
    };
    const projectTasks = {
      workflow_orchestrator: { providerId: 'anthropic' as ProviderId, model: 'claude-sonnet-5' },
    };
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, taskModels: workspaceTasks },
      projectOverride: { ...NULL_OVERRIDE, taskModels: projectTasks },
    });
    expect(result.taskModels).toEqual({
      workflow_orchestrator: projectTasks.workflow_orchestrator,
      summarizer: workspaceTasks.summarizer,
    });
  });

  it('task models: a session key beats a project key beats a workspace key', () => {
    const pin = (model: string) => ({ providerId: 'anthropic' as ProviderId, model });
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: {
        ...NULL_OVERRIDE,
        taskModels: { summarizer: pin('ws'), rebase: pin('ws'), recheck: pin('ws') },
      },
      projectOverride: {
        ...NULL_OVERRIDE,
        taskModels: { summarizer: pin('project'), rebase: pin('project') },
      },
      sessionOverride: { ...NULL_OVERRIDE, taskModels: { summarizer: pin('session') } },
    });
    expect(result.taskModels).toEqual({
      summarizer: pin('session'),
      rebase: pin('project'),
      recheck: pin('ws'),
    });
  });

  it('role models: merge key by key, project over workspace', () => {
    const pin = (model: string) => ({
      providerId: 'anthropic' as ProviderId,
      model,
      effort: 'high' as const,
    });
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: {
        ...NULL_OVERRIDE,
        roleModels: { planner: pin('ws'), reviewer: pin('ws') },
      },
      projectOverride: { ...NULL_OVERRIDE, roleModels: { planner: pin('project') } },
    });
    expect(result.roleModels).toEqual({ planner: pin('project'), reviewer: pin('ws') });
  });

  it('role and task models: empty maps in every scope resolve to null', () => {
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, roleModels: {}, taskModels: {} },
      projectOverride: { ...NULL_OVERRIDE, roleModels: {}, taskModels: null },
    });
    expect(result.roleModels).toBeNull();
    expect(result.taskModels).toBeNull();
  });

  it('role and task models: an own __proto__ key stays data and never changes the prototype', () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":true}}') as OverrideSettings['taskModels'];
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, taskModels: hostile },
    });
    expect(Object.getPrototypeOf(result.taskModels)).toBe(Object.prototype);
    expect(Reflect.get(result.taskModels ?? {}, 'polluted')).toBeUndefined();
  });

  it('provider pool stays whole: the project list replaces the workspace list', () => {
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: {
        ...NULL_OVERRIDE,
        providerPool: [
          { id: 'anthropic', state: 'on' },
          { id: 'codex', state: 'on' },
        ],
      },
      projectOverride: { ...NULL_OVERRIDE, providerPool: [{ id: 'codex', state: 'on' }] },
    });
    expect(result.providerPool).toEqual([{ id: 'codex', state: 'on' }]);
  });

  it('role and task models and pool resolve to null when no scope sets them', () => {
    const result = resolveSettings({ global: GLOBAL, workspaceOverride: NULL_OVERRIDE });
    expect(result.roleModels).toBeNull();
    expect(result.taskModels).toBeNull();
    expect(result.providerPool).toBeNull();
  });

  it('provider pool: the first scope that sets one wins', () => {
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, providerPool: [{ id: 'anthropic', state: 'on' }] },
      projectOverride: {
        ...NULL_OVERRIDE,
        providerPool: [
          { id: 'codex', state: 'on' },
          { id: 'cursor', state: 'backup' },
        ],
      },
    });
    expect(result.providerPool).toEqual([
      { id: 'codex', state: 'on' },
      { id: 'cursor', state: 'backup' },
    ]);
  });

  it('parallel agents: an explicit false below wins over true above', () => {
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, parallelAgents: true },
      sessionOverride: { ...NULL_OVERRIDE, parallelAgents: false },
    });
    expect(result.parallelAgents).toBe(false);
  });

  it('parallel agents: explicit false and an unset workspace resolve identically', () => {
    const explicit = resolveSettings({
      global: GLOBAL,
      workspaceOverride: { ...NULL_OVERRIDE, parallelAgents: false },
    });
    const unset = resolveSettings({ global: GLOBAL, workspaceOverride: NULL_OVERRIDE });
    expect(explicit.parallelAgents).toBe(false);
    expect(unset.parallelAgents).toBe(explicit.parallelAgents);
  });

  it('provider bindings: shallow merge, session over project over workspace', () => {
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: {
        ...NULL_OVERRIDE,
        providerBindings: { anthropic: 'ws-cred', codex: 'ws-codex' },
      },
      projectOverride: { ...NULL_OVERRIDE, providerBindings: { codex: 'project-codex' } },
      sessionOverride: { ...NULL_OVERRIDE, providerBindings: { anthropic: 'sess-cred' } },
    });
    expect(result.providerBindings).toEqual({ anthropic: 'sess-cred', codex: 'project-codex' });
  });

  it('provider bindings: empty when no scope binds anything', () => {
    const result = resolveSettings({ global: GLOBAL });
    expect(result.providerBindings).toEqual({});
  });
});
