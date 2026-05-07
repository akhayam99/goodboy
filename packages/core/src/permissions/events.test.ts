import { describe, expect, it } from 'vitest';
import type { IsoDateTime, PermissionRuleId, ProviderRunId } from '@kay-am/types';
import { createPermissionDecisionEvent, createPermissionRequestEvent } from './events';

const RUN_ID = 'run-1' as ProviderRunId;
const AT = '2026-01-01T00:00:00.000Z' as IsoDateTime;
const RULE_ID = 'rule-abc' as PermissionRuleId;

describe('createPermissionRequestEvent', () => {
  it('produces a permission_request event with correct shape', () => {
    const event = createPermissionRequestEvent({
      runId: RUN_ID,
      toolUseId: 'tu-1',
      toolName: 'bash',
      input: { cmd: 'ls' },
      at: AT,
    });
    expect(event.kind).toBe('permission_request');
    expect(event.runId).toBe(RUN_ID);
    expect(event.toolUseId).toBe('tu-1');
    expect(event.toolName).toBe('bash');
    expect(event.input).toEqual({ cmd: 'ls' });
    expect(event.at).toBe(AT);
  });

  it('accepts null/unknown input', () => {
    const event = createPermissionRequestEvent({
      runId: RUN_ID,
      toolUseId: 'tu-2',
      toolName: 'read_file',
      input: null,
      at: AT,
    });
    expect(event.input).toBeNull();
  });
});

describe('createPermissionDecisionEvent', () => {
  it('produces an allow decision with ruleId', () => {
    const event = createPermissionDecisionEvent({
      runId: RUN_ID,
      toolUseId: 'tu-1',
      decision: 'allow',
      ruleId: RULE_ID,
      decidedBy: 'engine',
      at: AT,
    });
    expect(event.kind).toBe('permission_decision');
    expect(event.decision).toBe('allow');
    expect(event.ruleId).toBe(RULE_ID);
    expect(event.decidedBy).toBe('engine');
  });

  it('produces a deny decision with null ruleId (default fallback)', () => {
    const event = createPermissionDecisionEvent({
      runId: RUN_ID,
      toolUseId: 'tu-2',
      decision: 'deny',
      ruleId: null,
      decidedBy: 'default',
      at: AT,
    });
    expect(event.decision).toBe('deny');
    expect(event.ruleId).toBeNull();
    expect(event.decidedBy).toBe('default');
  });

  it('supports decidedBy user', () => {
    const event = createPermissionDecisionEvent({
      runId: RUN_ID,
      toolUseId: 'tu-3',
      decision: 'allow',
      ruleId: null,
      decidedBy: 'user',
      at: AT,
    });
    expect(event.decidedBy).toBe('user');
  });
});
