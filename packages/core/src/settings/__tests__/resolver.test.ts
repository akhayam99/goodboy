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
      defaultWorkflowId: 'tpl-1' as WorkflowId,
      defaultBranchPrefix: 'ws-prefix',
      parallelEnabled: true,
      defaultVerbosity: 'verbose',
      providerBindings: null,
      taskModels: null,
      roleModels: null,
      parallelAgents: null,
      providerPool: null,
      attributionFooter: null,
    };
    const result = resolveSettings({ global: GLOBAL, workspaceOverride: wsOverride });
    expect(result.defaultProviderId).toBe('cursor');
    expect(result.defaultWorkflowId).toBe('tpl-1');
    expect(result.defaultBranchPrefix).toBe('ws-prefix');
    expect(result.parallelEnabled).toBe(true);
    expect(result.defaultVerbosity).toBe('verbose');
  });

  it('null/null/value (session) → session wins for provider/workflow/prefix/parallel; session.defaultVerbosity always null in production', () => {
    const sessOverride: OverrideSettings = {
      defaultProviderId: 'codex' as ProviderId,
      defaultWorkflowId: 'tpl-2' as WorkflowId,
      defaultBranchPrefix: 'sess-prefix',
      parallelEnabled: true,
      defaultVerbosity: null,
      providerBindings: null,
      taskModels: null,
      roleModels: null,
      parallelAgents: null,
      providerPool: null,
      attributionFooter: null,
    };
    const result = resolveSettings({ global: GLOBAL, sessionOverride: sessOverride });
    expect(result.defaultProviderId).toBe('codex');
    expect(result.defaultWorkflowId).toBe('tpl-2');
    expect(result.defaultBranchPrefix).toBe('sess-prefix');
    expect(result.parallelEnabled).toBe(true);
    expect(result.defaultVerbosity).toBe('normal');
  });

  it('session overrides win over workspace for non-verbosity fields', () => {
    const wsOverride: OverrideSettings = {
      defaultProviderId: 'cursor' as ProviderId,
      defaultWorkflowId: 'tpl-ws' as WorkflowId,
      defaultBranchPrefix: 'ws-prefix',
      parallelEnabled: false,
      defaultVerbosity: 'verbose',
      providerBindings: null,
      taskModels: null,
      roleModels: null,
      parallelAgents: null,
      providerPool: null,
      attributionFooter: null,
    };
    const sessOverride: OverrideSettings = {
      defaultProviderId: 'codex' as ProviderId,
      defaultWorkflowId: 'tpl-sess' as WorkflowId,
      defaultBranchPrefix: 'sess-prefix',
      parallelEnabled: true,
      defaultVerbosity: null,
      providerBindings: null,
      taskModels: null,
      roleModels: null,
      parallelAgents: null,
      providerPool: null,
      attributionFooter: null,
    };
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: wsOverride,
      sessionOverride: sessOverride,
    });
    expect(result.defaultProviderId).toBe('codex');
    expect(result.defaultWorkflowId).toBe('tpl-sess');
    expect(result.defaultBranchPrefix).toBe('sess-prefix');
    expect(result.parallelEnabled).toBe(true);
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
      defaultWorkflowId: null,
      defaultBranchPrefix: 'ws-prefix',
      parallelEnabled: true,
      defaultVerbosity: 'verbose',
      providerBindings: null,
      taskModels: null,
      roleModels: null,
      parallelAgents: null,
      providerPool: null,
      attributionFooter: null,
    };
    const sessOverride: OverrideSettings = {
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
    };
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: wsOverride,
      sessionOverride: sessOverride,
    });
    expect(result.defaultProviderId).toBe('cursor');
    expect(result.defaultBranchPrefix).toBe('ws-prefix');
    expect(result.parallelEnabled).toBe(true);
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
    expect(result.roleModels).toBe(projectRoles);
    expect(result.taskModels).toBe(sessionTasks);
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
      workspaceOverride: { ...NULL_OVERRIDE, providerPool: ['anthropic' as ProviderId] },
      projectOverride: {
        ...NULL_OVERRIDE,
        providerPool: ['codex' as ProviderId, 'cursor' as ProviderId],
      },
    });
    expect(result.providerPool).toEqual(['codex', 'cursor']);
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
