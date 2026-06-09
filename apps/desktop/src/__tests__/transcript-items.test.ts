import { describe, expect, it } from 'vitest';
import type { IsoDateTime, PermissionRuleId, ProviderRunId, TurnEvent } from '@goodboy/types';
import { reduceTranscript } from '../features/chat/utils/transcript-items';

const RUN = 'run-1' as ProviderRunId;
const AT = '2026-01-01T00:00:00.000Z' as IsoDateTime;
const RULE_ID = 'rule-abc' as PermissionRuleId;

function permReqEvent(toolUseId = 'tu-1'): TurnEvent {
  return {
    kind: 'permission_request',
    runId: RUN,
    toolUseId,
    toolName: 'bash',
    input: { cmd: 'ls' },
    at: AT,
  };
}

function permDecEvent(
  toolUseId = 'tu-1',
  decision: 'allow' | 'deny' = 'allow',
  ruleId: PermissionRuleId | null = RULE_ID,
  decidedBy: 'engine' | 'user' | 'default' = 'engine',
): TurnEvent {
  return {
    kind: 'permission_decision',
    runId: RUN,
    toolUseId,
    decision,
    ruleId,
    decidedBy,
    at: AT,
  };
}

describe('reduceTranscript, permission_request', () => {
  it('produces a permission_request item', () => {
    const items = reduceTranscript([permReqEvent()]);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.kind).toBe('permission_request');
    if (item.kind !== 'permission_request') {
      return;
    }
    expect(item.toolName).toBe('bash');
    expect(item.toolUseId).toBe('tu-1');
    expect(item.runId).toBe(RUN);
    expect(item.input).toEqual({ cmd: 'ls' });
    expect(item.at).toBe(AT);
  });

  it('key contains toolUseId', () => {
    const items = reduceTranscript([permReqEvent('tu-xyz')]);
    const item = items[0]!;
    expect(item.key).toContain('tu-xyz');
  });

  it('multiple permission_request events produce separate items', () => {
    const items = reduceTranscript([permReqEvent('tu-1'), permReqEvent('tu-2')]);
    expect(items).toHaveLength(2);
    expect(items[0]!.kind).toBe('permission_request');
    expect(items[1]!.kind).toBe('permission_request');
  });
});

describe('reduceTranscript, permission_decision', () => {
  it('produces a permission_decision item with allow + ruleId', () => {
    const items = reduceTranscript([permDecEvent('tu-1', 'allow', RULE_ID, 'engine')]);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.kind).toBe('permission_decision');
    if (item.kind !== 'permission_decision') {
      return;
    }
    expect(item.decision).toBe('allow');
    expect(item.ruleId).toBe(RULE_ID);
    expect(item.decidedBy).toBe('engine');
    expect(item.runId).toBe(RUN);
  });

  it('produces a deny decision with null ruleId', () => {
    const items = reduceTranscript([permDecEvent('tu-2', 'deny', null, 'default')]);
    const item = items[0]!;
    expect(item.kind).toBe('permission_decision');
    if (item.kind !== 'permission_decision') {
      return;
    }
    expect(item.decision).toBe('deny');
    expect(item.ruleId).toBeNull();
    expect(item.decidedBy).toBe('default');
  });

  it('key contains toolUseId', () => {
    const items = reduceTranscript([permDecEvent('tu-abc')]);
    const item = items[0]!;
    expect(item.key).toContain('tu-abc');
  });

  it('carries toolName from paired permission_request event', () => {
    const items = reduceTranscript([permReqEvent('tu-1'), permDecEvent('tu-1', 'deny', null)]);
    const dec = items[1]!;
    expect(dec.kind).toBe('permission_decision');
    if (dec.kind !== 'permission_decision') {
      return;
    }
    expect(dec.toolName).toBe('bash');
  });

  it('falls back to toolUseId when no prior request event', () => {
    const items = reduceTranscript([permDecEvent('tu-orphan', 'deny', null)]);
    const dec = items[0]!;
    expect(dec.kind).toBe('permission_decision');
    if (dec.kind !== 'permission_decision') {
      return;
    }
    expect(dec.toolName).toBe('tu-orphan');
  });
});

describe('reduceTranscript, request + decision pair', () => {
  it('produces two items for a request followed by a decision', () => {
    const events: TurnEvent[] = [permReqEvent('tu-1'), permDecEvent('tu-1', 'deny', null, 'user')];
    const items = reduceTranscript(events);
    expect(items).toHaveLength(2);
    expect(items[0]!.kind).toBe('permission_request');
    expect(items[1]!.kind).toBe('permission_decision');
  });
});
