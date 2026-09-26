import { describe, expect, it } from 'vitest';
import type { IsoDateTime, PermissionRule, PermissionRuleId } from '@goodboy/types';
import { describeRule } from './describeRule';
import { hasIgnoredDeny, modeCell, ruleCell, splitRuleProviders } from './providerSupport';

const rule = (decision: PermissionRule['decision']): PermissionRule => ({
  id: `rule-${decision}` as PermissionRuleId,
  scope: 'workspace',
  pattern: { tool: 'Bash', argsMatcher: 'git push *' },
  decision,
  priority: 0,
  createdAt: '2026-09-26T10:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-26T10:00:00.000Z' as IsoDateTime,
});

describe('modeCell', () => {
  it('says a mode works where the provider honors it', () => {
    expect(modeCell({ provider: 'anthropic', mode: 'plan' })).toMatchObject({
      glyph: '✓',
      word: 'Works',
    });
  });

  it('names the stricter mode a provider falls back to, never a looser one', () => {
    expect(modeCell({ provider: 'codex', mode: 'default' })).toMatchObject({
      glyph: '✕',
      word: 'Runs Read only',
    });
  });

  it('gives the reason when a mode only partly holds', () => {
    expect(modeCell({ provider: 'opencode', mode: 'plan' })).toMatchObject({
      glyph: '≈',
      detail: 'Edits are blocked, shell commands still run',
    });
  });
});

describe('rules per provider', () => {
  it('lets only Claude follow allow and deny rules', () => {
    expect(ruleCell({ provider: 'anthropic' }).word).toBe('Works');
    expect(ruleCell({ provider: 'cursor' }).word).toBe('Ignored');
    expect(splitRuleProviders({ providers: ['anthropic', 'codex', 'cursor'] })).toEqual({
      followers: ['anthropic'],
      ignorers: ['codex', 'cursor'],
    });
  });

  it('warns about a deny rule only when a provider that ignores it runs here', () => {
    expect(hasIgnoredDeny({ rules: [rule('deny')], activeProviders: ['anthropic', 'codex'] })).toBe(
      true,
    );
    expect(hasIgnoredDeny({ rules: [rule('deny')], activeProviders: ['anthropic'] })).toBe(false);
    expect(hasIgnoredDeny({ rules: [rule('allow')], activeProviders: ['codex'] })).toBe(false);
  });
});

describe('describeRule', () => {
  it('reads a command prefix and an edit rule as words', () => {
    expect(describeRule({ pattern: { tool: 'Bash', argsMatcher: 'pnpm test *' } })).toBe(
      'Commands starting with "pnpm test"',
    );
    expect(describeRule({ pattern: { tool: 'Bash', argsMatcher: 'git push:*' } })).toBe(
      'Commands starting with "git push"',
    );
    expect(describeRule({ pattern: { tool: 'Edit' } })).toBe('Edits to files');
    expect(describeRule({ pattern: { tool: 'Bash' } })).toBe('Any command');
  });
});
