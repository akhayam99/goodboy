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
};

const NULL_OVERRIDE: OverrideSettings = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
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
    };
    const result = resolveSettings({ global: GLOBAL, workspaceOverride: wsOverride });
    expect(result.defaultProviderId).toBe('cursor');
    expect(result.defaultWorkflowId).toBe('tpl-1');
    expect(result.defaultBranchPrefix).toBe('ws-prefix');
    expect(result.parallelEnabled).toBe(true);
  });

  it('null/null/value → session wins', () => {
    const sessOverride: OverrideSettings = {
      defaultProviderId: 'codex' as ProviderId,
      defaultWorkflowId: 'tpl-2' as WorkflowId,
      defaultBranchPrefix: 'sess-prefix',
      parallelEnabled: true,
    };
    const result = resolveSettings({ global: GLOBAL, sessionOverride: sessOverride });
    expect(result.defaultProviderId).toBe('codex');
    expect(result.defaultWorkflowId).toBe('tpl-2');
    expect(result.defaultBranchPrefix).toBe('sess-prefix');
    expect(result.parallelEnabled).toBe(true);
  });

  it('null/value/value → session wins over workspace', () => {
    const wsOverride: OverrideSettings = {
      defaultProviderId: 'cursor' as ProviderId,
      defaultWorkflowId: 'tpl-ws' as WorkflowId,
      defaultBranchPrefix: 'ws-prefix',
      parallelEnabled: false,
    };
    const sessOverride: OverrideSettings = {
      defaultProviderId: 'codex' as ProviderId,
      defaultWorkflowId: 'tpl-sess' as WorkflowId,
      defaultBranchPrefix: 'sess-prefix',
      parallelEnabled: true,
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
  });

  it('null/value/null-fields → session null fields fall back to workspace', () => {
    const wsOverride: OverrideSettings = {
      defaultProviderId: 'cursor' as ProviderId,
      defaultWorkflowId: null,
      defaultBranchPrefix: 'ws-prefix',
      parallelEnabled: true,
    };
    const sessOverride: OverrideSettings = {
      defaultProviderId: null,
      defaultWorkflowId: null,
      defaultBranchPrefix: null,
      parallelEnabled: null,
    };
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: wsOverride,
      sessionOverride: sessOverride,
    });
    expect(result.defaultProviderId).toBe('cursor');
    expect(result.defaultBranchPrefix).toBe('ws-prefix');
    expect(result.parallelEnabled).toBe(true);
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
});
