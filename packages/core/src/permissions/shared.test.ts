import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  PermissionRule,
  PermissionRuleId,
  PermissionRuleScope,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { SCOPE_RANK, isApplicable } from './shared';

const AT = '2024-01-01T00:00:00.000Z' as IsoDateTime;
const SESSION_A = 'session-a' as SessionId;
const SESSION_B = 'session-b' as SessionId;
const WS_A = 'ws-a' as WorkspaceId;
const WS_B = 'ws-b' as WorkspaceId;
const CTX = { sessionId: SESSION_A, workspaceId: WS_A };

const makeRule = (
  overrides: Partial<PermissionRule> & Pick<PermissionRule, 'scope'>,
): PermissionRule => ({
  id: 'rule-1' as PermissionRuleId,
  decision: 'allow',
  pattern: { tool: '*' },
  priority: 0,
  createdAt: AT,
  updatedAt: AT,
  ...overrides,
});

describe('SCOPE_RANK', () => {
  it('ranks session above workspace above global', () => {
    expect(SCOPE_RANK.session).toBeGreaterThan(SCOPE_RANK.workspace);
    expect(SCOPE_RANK.workspace).toBeGreaterThan(SCOPE_RANK.global);
  });

  it('assigns a rank to every scope', () => {
    const scopes: PermissionRuleScope[] = ['session', 'workspace', 'global'];
    for (const scope of scopes) {
      expect(typeof SCOPE_RANK[scope]).toBe('number');
    }
  });
});

describe('isApplicable', () => {
  it('global rules always apply', () => {
    expect(isApplicable(makeRule({ scope: 'global' }), CTX)).toBe(true);
  });

  it('session rule applies only to its own session', () => {
    expect(isApplicable(makeRule({ scope: 'session', sessionId: SESSION_A }), CTX)).toBe(true);
    expect(isApplicable(makeRule({ scope: 'session', sessionId: SESSION_B }), CTX)).toBe(false);
  });

  it('workspace rule applies only to its own workspace', () => {
    expect(isApplicable(makeRule({ scope: 'workspace', workspaceId: WS_A }), CTX)).toBe(true);
    expect(isApplicable(makeRule({ scope: 'workspace', workspaceId: WS_B }), CTX)).toBe(false);
  });
});
