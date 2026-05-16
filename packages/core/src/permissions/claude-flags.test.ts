import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  PermissionRule,
  PermissionRuleId,
  SessionId,
  WorkspaceId,
} from '@kay-am/types';
import { buildClaudeFlags } from './claude-flags';

const AT = '2024-01-01T00:00:00.000Z' as IsoDateTime;
const SESSION = 'session-1' as SessionId;
const WS = 'ws-1' as WorkspaceId;
const SCOPE = { sessionId: SESSION, workspaceId: WS };

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

describe('buildClaudeFlags', () => {
  it('allow-Edit-only set', () => {
    const rules: PermissionRule[] = [
      makeRule({ id: 'r1' as PermissionRuleId, decision: 'allow', pattern: { tool: 'Edit' } }),
    ];
    expect(buildClaudeFlags({ rules, scope: SCOPE })).toMatchInlineSnapshot(`
      {
        "allowedTools": [
          "Edit",
        ],
        "disallowedTools": [],
        "permissionMode": "default",
      }
    `);
  });

  it('deny rm + allow everything else', () => {
    const rules: PermissionRule[] = [
      makeRule({
        id: 'r1' as PermissionRuleId,
        decision: 'deny',
        pattern: { tool: 'Bash', argsMatcher: 'rm:*' },
        priority: 10,
      }),
      makeRule({
        id: 'r2' as PermissionRuleId,
        decision: 'allow',
        pattern: { tool: '*' },
        priority: 0,
      }),
    ];
    expect(buildClaudeFlags({ rules, scope: SCOPE })).toMatchInlineSnapshot(`
      {
        "allowedTools": [
          "*",
        ],
        "disallowedTools": [
          "Bash(rm:*)",
        ],
        "permissionMode": "default",
      }
    `);
  });

  it('mixed scopes — both rendered, session deny alongside workspace allow', () => {
    const rules: PermissionRule[] = [
      makeRule({
        id: 'ws-allow' as PermissionRuleId,
        scope: 'workspace',
        workspaceId: WS,
        decision: 'allow',
        pattern: { tool: 'Edit' },
        priority: 5,
      }),
      makeRule({
        id: 'session-deny' as PermissionRuleId,
        scope: 'session',
        sessionId: SESSION,
        decision: 'deny',
        pattern: { tool: 'Edit' },
        priority: 5,
      }),
    ];
    expect(buildClaudeFlags({ rules, scope: SCOPE })).toMatchInlineSnapshot(`
      {
        "allowedTools": [
          "Edit",
        ],
        "disallowedTools": [
          "Edit",
        ],
        "permissionMode": "default",
      }
    `);
  });

  it('defaults to permissionMode: default when not provided', () => {
    const result = buildClaudeFlags({ rules: [], scope: SCOPE });
    expect(result.permissionMode).toBe('default');
  });

  it('propagates provided permissionMode', () => {
    const result = buildClaudeFlags({
      rules: [],
      scope: SCOPE,
      permissionMode: 'bypassPermissions',
    });
    expect(result.permissionMode).toBe('bypassPermissions');
  });

  it('ask rules do not appear in either list', () => {
    const rules: PermissionRule[] = [
      makeRule({ id: 'r1' as PermissionRuleId, decision: 'ask', pattern: { tool: 'Bash' } }),
    ];
    const result = buildClaudeFlags({ rules, scope: SCOPE });
    expect(result.allowedTools).toHaveLength(0);
    expect(result.disallowedTools).toHaveLength(0);
  });

  it('de-duplication: same pattern appears only once per list', () => {
    const rules: PermissionRule[] = [
      makeRule({
        id: 'r1' as PermissionRuleId,
        decision: 'allow',
        pattern: { tool: 'Edit' },
        priority: 2,
      }),
      makeRule({
        id: 'r2' as PermissionRuleId,
        decision: 'allow',
        pattern: { tool: 'Edit' },
        priority: 1,
      }),
    ];
    const result = buildClaudeFlags({ rules, scope: SCOPE });
    expect(result.allowedTools).toEqual(['Edit']);
  });

  it('rules outside scope are excluded', () => {
    const rules: PermissionRule[] = [
      makeRule({
        id: 'r1' as PermissionRuleId,
        scope: 'session',
        sessionId: 'other-session' as SessionId,
        decision: 'allow',
        pattern: { tool: 'Edit' },
      }),
    ];
    const result = buildClaudeFlags({ rules, scope: SCOPE });
    expect(result.allowedTools).toHaveLength(0);
  });
});
