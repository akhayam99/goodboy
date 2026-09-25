import { describe, expect, it } from 'vitest';
import { resolveAuto } from './resolveAuto';

describe('resolveAuto', () => {
  it('starts from the curated default of the workspace default provider', () => {
    expect(
      resolveAuto({ slot: { kind: 'role', id: 'implementer' }, defaultProvider: 'codex' }),
    ).toEqual({ provider: 'codex', model: 'gpt-5.6-sol', effort: 'medium', step: 'curated' });
  });

  it('moves down the same column when the cli is too old for the first pick', () => {
    expect(
      resolveAuto({
        slot: { kind: 'role', id: 'planner' },
        defaultProvider: 'anthropic',
        cliVersions: { anthropic: '2.1.200' },
      }),
    ).toEqual({ provider: 'anthropic', model: 'opus-5', effort: 'high', step: 'next-in-column' });
  });

  it('keeps the first pick when the cli is new enough', () => {
    expect(
      resolveAuto({
        slot: { kind: 'role', id: 'planner' },
        defaultProvider: 'anthropic',
        cliVersions: { anthropic: '2.1.280' },
      })?.model,
    ).toBe('opus-5.5');
  });

  it('moves to the next provider in the fallback order when the default is not connected', () => {
    expect(
      resolveAuto({
        slot: { kind: 'task', id: 'summarizer' },
        defaultProvider: 'codex',
        fallbackOrder: ['codex', 'gemini', 'anthropic'],
        connected: ['anthropic', 'gemini'],
      }),
    ).toEqual({
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      effort: 'low',
      step: 'next-provider',
    });
  });

  it('leaves out a provider outside the fallback order', () => {
    expect(
      resolveAuto({
        slot: { kind: 'role', id: 'reviewer' },
        defaultProvider: 'codex',
        fallbackOrder: ['codex', 'cursor'],
        connected: ['anthropic', 'cursor'],
      })?.provider,
    ).toBe('cursor');
  });

  it('searches by cost tier on a provider with no curated column', () => {
    const pick = resolveAuto({
      slot: { kind: 'role', id: 'scout' },
      defaultProvider: 'opencode',
      connected: ['opencode'],
    });
    expect(pick?.provider).toBe('opencode');
    expect(pick?.step).toBe('cost-tier');
  });

  it('tries every curated provider before a cost tier search', () => {
    expect(
      resolveAuto({
        slot: { kind: 'role', id: 'implementer' },
        defaultProvider: 'codex',
        fallbackOrder: ['codex', 'opencode', 'gemini'],
        connected: ['opencode', 'gemini'],
      })?.provider,
    ).toBe('gemini');
  });

  it('says nothing when no provider is connected', () => {
    expect(
      resolveAuto({
        slot: { kind: 'role', id: 'scout' },
        defaultProvider: 'anthropic',
        connected: [],
      }),
    ).toBeNull();
  });

  it('skips a provider at its usage limit and says which one it skipped', () => {
    expect(
      resolveAuto({
        slot: { kind: 'role', id: 'implementer' },
        defaultProvider: 'anthropic',
        fallbackOrder: ['anthropic', 'codex', 'gemini'],
        connected: ['anthropic', 'codex'],
        atLimit: ['anthropic'],
      }),
    ).toEqual({
      provider: 'codex',
      model: 'gpt-5.6-sol',
      effort: 'medium',
      step: 'next-provider',
      skippedAtLimit: ['anthropic'],
    });
  });

  it('keeps the default when only a later provider is at its limit', () => {
    const pick = resolveAuto({
      slot: { kind: 'role', id: 'implementer' },
      defaultProvider: 'anthropic',
      fallbackOrder: ['anthropic', 'codex'],
      connected: ['anthropic', 'codex'],
      atLimit: ['codex'],
    });
    expect(pick?.provider).toBe('anthropic');
    expect(pick?.skippedAtLimit).toBeUndefined();
  });

  it('says nothing when every connected provider is at its limit', () => {
    expect(
      resolveAuto({
        slot: { kind: 'task', id: 'summarizer' },
        defaultProvider: 'codex',
        connected: ['codex'],
        atLimit: ['codex'],
      }),
    ).toBeNull();
  });

  it('writes a cursor thinking pick as the slug the cli runs', () => {
    expect(
      resolveAuto({ slot: { kind: 'role', id: 'reviewer' }, defaultProvider: 'cursor' })?.model,
    ).toBe('claude-4.6-sonnet-medium-thinking');
  });
});
