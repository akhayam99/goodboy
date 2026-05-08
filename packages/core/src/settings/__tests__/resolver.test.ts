import { describe, it, expect } from 'vitest';
import { resolveSettings } from '../resolver';
import type { GlobalSettings, OverrideSettings } from '@kay-am/types';
import type { PhaseTemplateId } from '@kay-am/types';
import type { ProviderId } from '@kay-am/types';

const GLOBAL: GlobalSettings = {
  defaultProviderId: 'anthropic' as ProviderId,
  defaultPhaseTemplateId: null,
  defaultBranchPrefix: 'kay',
  parallelEnabled: false,
};

const NULL_OVERRIDE: OverrideSettings = {
  defaultProviderId: null,
  defaultPhaseTemplateId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
};

describe('resolveSettings', () => {
  it('null/null/null → global only', () => {
    const result = resolveSettings({ global: GLOBAL });
    expect(result.defaultProviderId).toBe('anthropic');
    expect(result.defaultBranchPrefix).toBe('kay');
    expect(result.parallelEnabled).toBe(false);
    expect(result.defaultPhaseTemplateId).toBeNull();
  });

  it('null/value/null → workspace wins', () => {
    const wsOverride: OverrideSettings = {
      defaultProviderId: 'cursor' as ProviderId,
      defaultPhaseTemplateId: 'tpl-1' as PhaseTemplateId,
      defaultBranchPrefix: 'ws-prefix',
      parallelEnabled: true,
    };
    const result = resolveSettings({ global: GLOBAL, workspaceOverride: wsOverride });
    expect(result.defaultProviderId).toBe('cursor');
    expect(result.defaultPhaseTemplateId).toBe('tpl-1');
    expect(result.defaultBranchPrefix).toBe('ws-prefix');
    expect(result.parallelEnabled).toBe(true);
  });

  it('null/null/value → session wins', () => {
    const sessOverride: OverrideSettings = {
      defaultProviderId: 'codex' as ProviderId,
      defaultPhaseTemplateId: 'tpl-2' as PhaseTemplateId,
      defaultBranchPrefix: 'sess-prefix',
      parallelEnabled: true,
    };
    const result = resolveSettings({ global: GLOBAL, sessionOverride: sessOverride });
    expect(result.defaultProviderId).toBe('codex');
    expect(result.defaultPhaseTemplateId).toBe('tpl-2');
    expect(result.defaultBranchPrefix).toBe('sess-prefix');
    expect(result.parallelEnabled).toBe(true);
  });

  it('null/value/value → session wins over workspace', () => {
    const wsOverride: OverrideSettings = {
      defaultProviderId: 'cursor' as ProviderId,
      defaultPhaseTemplateId: 'tpl-ws' as PhaseTemplateId,
      defaultBranchPrefix: 'ws-prefix',
      parallelEnabled: false,
    };
    const sessOverride: OverrideSettings = {
      defaultProviderId: 'codex' as ProviderId,
      defaultPhaseTemplateId: 'tpl-sess' as PhaseTemplateId,
      defaultBranchPrefix: 'sess-prefix',
      parallelEnabled: true,
    };
    const result = resolveSettings({
      global: GLOBAL,
      workspaceOverride: wsOverride,
      sessionOverride: sessOverride,
    });
    expect(result.defaultProviderId).toBe('codex');
    expect(result.defaultPhaseTemplateId).toBe('tpl-sess');
    expect(result.defaultBranchPrefix).toBe('sess-prefix');
    expect(result.parallelEnabled).toBe(true);
  });

  it('null/value/null-fields → session null fields fall back to workspace', () => {
    const wsOverride: OverrideSettings = {
      defaultProviderId: 'cursor' as ProviderId,
      defaultPhaseTemplateId: null,
      defaultBranchPrefix: 'ws-prefix',
      parallelEnabled: true,
    };
    const sessOverride: OverrideSettings = {
      defaultProviderId: null,
      defaultPhaseTemplateId: null,
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

  it('global with non-null phaseTemplateId is inherited when overrides are null', () => {
    const globalWithTemplate: GlobalSettings = {
      ...GLOBAL,
      defaultPhaseTemplateId: 'global-tpl' as PhaseTemplateId,
    };
    const result = resolveSettings({ global: globalWithTemplate });
    expect(result.defaultPhaseTemplateId).toBe('global-tpl');
  });
});
