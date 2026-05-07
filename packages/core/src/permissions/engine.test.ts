import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  PermissionRequest,
  PermissionRule,
  PermissionRuleId,
  PermissionRequestId,
  SessionId,
  WorkspaceId,
} from '@kay-am/types';
import { PermissionEngine } from './engine';

const AT = '2024-01-01T00:00:00.000Z' as IsoDateTime;
const SESSION_A = 'session-a' as SessionId;
const SESSION_B = 'session-b' as SessionId;
const WS_A = 'ws-a' as WorkspaceId;
const WS_B = 'ws-b' as WorkspaceId;
const CTX = { sessionId: SESSION_A, workspaceId: WS_A };

function makeRequest(toolName: string, input: unknown = {}): PermissionRequest {
  return {
    id: 'req-1' as PermissionRequestId,
    runId: 'run-1' as never,
    toolUseId: 'tool-use-1',
    toolName,
    input,
    at: AT,
  };
}

function makeRule(
  overrides: Partial<PermissionRule> & Pick<PermissionRule, 'id' | 'decision'>,
): PermissionRule {
  return {
    scope: 'global',
    pattern: { tool: '*' },
    priority: 0,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

describe('PermissionEngine.decide', () => {
  const engine = new PermissionEngine();

  it('no match → deny by default', () => {
    const result = engine.decide(makeRequest('Edit'), [], CTX);
    expect(result.decision).toBe('deny');
    expect(result.ruleId).toBeNull();
    expect(result.decidedBy).toBe('default');
    expect(result.requestId).toBe('req-1');
    expect(result.at).toBe(AT);
  });

  it('no match → allow when defaultDecision=allow', () => {
    const e = new PermissionEngine({ defaultDecision: 'allow' });
    const result = e.decide(makeRequest('Edit'), [], CTX);
    expect(result.decision).toBe('allow');
    expect(result.decidedBy).toBe('default');
  });

  it('ruleId set when rule matched, decidedBy=rule', () => {
    const rule = makeRule({
      id: 'rule-x' as PermissionRuleId,
      decision: 'allow',
      pattern: { tool: 'Edit' },
    });
    const result = engine.decide(makeRequest('Edit'), [rule], CTX);
    expect(result.ruleId).toBe('rule-x');
    expect(result.decidedBy).toBe('rule');
  });

  it('session scope wins over global at equal priority', () => {
    const globalAllow = makeRule({
      id: 'global-allow' as PermissionRuleId,
      scope: 'global',
      decision: 'allow',
      priority: 5,
      pattern: { tool: 'Edit' },
    });
    const sessionDeny = makeRule({
      id: 'session-deny' as PermissionRuleId,
      scope: 'session',
      sessionId: SESSION_A,
      decision: 'deny',
      priority: 5,
      pattern: { tool: 'Edit' },
    });
    const result = engine.decide(makeRequest('Edit'), [globalAllow, sessionDeny], CTX);
    expect(result.decision).toBe('deny');
    expect(result.ruleId).toBe('session-deny');
  });

  it('workspace scope wins over global at equal priority', () => {
    const globalAllow = makeRule({
      id: 'global-allow' as PermissionRuleId,
      scope: 'global',
      decision: 'allow',
      priority: 5,
      pattern: { tool: 'Edit' },
    });
    const wsDeny = makeRule({
      id: 'ws-deny' as PermissionRuleId,
      scope: 'workspace',
      workspaceId: WS_A,
      decision: 'deny',
      priority: 5,
      pattern: { tool: 'Edit' },
    });
    const result = engine.decide(makeRequest('Edit'), [globalAllow, wsDeny], CTX);
    expect(result.decision).toBe('deny');
    expect(result.ruleId).toBe('ws-deny');
  });

  it('session scope wins over workspace scope', () => {
    const wsAllow = makeRule({
      id: 'ws-allow' as PermissionRuleId,
      scope: 'workspace',
      workspaceId: WS_A,
      decision: 'allow',
      priority: 5,
      pattern: { tool: 'Edit' },
    });
    const sessionDeny = makeRule({
      id: 'session-deny' as PermissionRuleId,
      scope: 'session',
      sessionId: SESSION_A,
      decision: 'deny',
      priority: 5,
      pattern: { tool: 'Edit' },
    });
    const result = engine.decide(makeRequest('Edit'), [wsAllow, sessionDeny], CTX);
    expect(result.decision).toBe('deny');
    expect(result.ruleId).toBe('session-deny');
  });

  it('higher priority wins regardless of scope', () => {
    const sessionDeny = makeRule({
      id: 'session-deny' as PermissionRuleId,
      scope: 'session',
      sessionId: SESSION_A,
      decision: 'deny',
      priority: 1,
      pattern: { tool: 'Edit' },
    });
    const globalAllow = makeRule({
      id: 'global-allow' as PermissionRuleId,
      scope: 'global',
      decision: 'allow',
      priority: 10,
      pattern: { tool: 'Edit' },
    });
    const result = engine.decide(makeRequest('Edit'), [sessionDeny, globalAllow], CTX);
    expect(result.decision).toBe('allow');
    expect(result.ruleId).toBe('global-allow');
  });

  it('deny beats allow at equal precedence', () => {
    const allow = makeRule({
      id: 'allow-rule' as PermissionRuleId,
      scope: 'global',
      decision: 'allow',
      priority: 5,
      pattern: { tool: 'Edit' },
    });
    const deny = makeRule({
      id: 'deny-rule' as PermissionRuleId,
      scope: 'global',
      decision: 'deny',
      priority: 5,
      pattern: { tool: 'Edit' },
    });
    const result = engine.decide(makeRequest('Edit'), [allow, deny], CTX);
    expect(result.decision).toBe('deny');
  });

  it('ask treated as deny at engine level', () => {
    const ask = makeRule({
      id: 'ask-rule' as PermissionRuleId,
      scope: 'global',
      decision: 'ask',
      priority: 5,
      pattern: { tool: 'Bash' },
    });
    const result = engine.decide(makeRequest('Bash', { command: 'ls' }), [ask], CTX);
    expect(result.decision).toBe('deny');
  });

  it('rules for other sessions/workspaces are excluded', () => {
    const otherSession = makeRule({
      id: 'other-session' as PermissionRuleId,
      scope: 'session',
      sessionId: SESSION_B,
      decision: 'allow',
      priority: 100,
      pattern: { tool: 'Edit' },
    });
    const otherWs = makeRule({
      id: 'other-ws' as PermissionRuleId,
      scope: 'workspace',
      workspaceId: WS_B,
      decision: 'allow',
      priority: 100,
      pattern: { tool: 'Edit' },
    });
    const result = engine.decide(makeRequest('Edit'), [otherSession, otherWs], CTX);
    expect(result.decision).toBe('deny');
    expect(result.ruleId).toBeNull();
  });

  it('specificity: concrete tool beats glob at equal priority+scope', () => {
    const glob = makeRule({
      id: 'glob-deny' as PermissionRuleId,
      scope: 'global',
      decision: 'deny',
      priority: 5,
      pattern: { tool: '*' },
    });
    const specific = makeRule({
      id: 'specific-allow' as PermissionRuleId,
      scope: 'global',
      decision: 'allow',
      priority: 5,
      pattern: { tool: 'Edit' },
    });
    const result = engine.decide(makeRequest('Edit'), [glob, specific], CTX);
    expect(result.decision).toBe('allow');
    expect(result.ruleId).toBe('specific-allow');
  });
});
