import { describe, expect, it } from 'vitest';
import { suggestHeavierModel, suggestLighterModel } from '../features/chat/utils/chat-constants';

const ANTHROPIC = [
  'claude-haiku-4-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-opus-4-7',
  'claude-opus-4-8',
  'claude-opus-5',
  'claude-fable-5',
];

const CODEX = ['gpt-5.6-luna', 'gpt-5.2', 'gpt-5.3-codex', 'gpt-5.6-terra', 'gpt-5.5'];

const GEMINI = ['gemini-3.8-flash', 'gemini-3.1-pro'];

describe('suggestLighterModel', () => {
  it('Opus 4.8 → Sonnet 4.6, strong, about 1.7x cheaper', () => {
    expect(
      suggestLighterModel({
        provider: 'anthropic',
        current: 'claude-opus-4-8',
        candidates: ANTHROPIC,
      }),
    ).toEqual({
      id: 'claude-sonnet-4-6',
      kind: 'strong',
      costMultiplier: 1.7,
    });
  });

  it('Opus 5 → Sonnet 4.6, strong, about 1.7x cheaper', () => {
    expect(
      suggestLighterModel({
        provider: 'anthropic',
        current: 'claude-opus-5',
        candidates: ANTHROPIC,
      }),
    ).toEqual({
      id: 'claude-sonnet-4-6',
      kind: 'strong',
      costMultiplier: 1.7,
    });
  });

  it('Fable 5 → Sonnet 4.6 (top tier drops to mid, never to cheap)', () => {
    expect(
      suggestLighterModel({
        provider: 'anthropic',
        current: 'claude-fable-5',
        candidates: ANTHROPIC,
      })?.id,
    ).toBe('claude-sonnet-4-6');
  });

  it('never suggests below the cheap-tier floor', () => {
    expect(
      suggestLighterModel({
        provider: 'anthropic',
        current: 'claude-opus-4-8',
        candidates: ANTHROPIC,
      })?.id,
    ).not.toMatch(/haiku/);
  });

  it('no nag when already mid-tier (cheap tier is floored out)', () => {
    expect(
      suggestLighterModel({
        provider: 'anthropic',
        current: 'claude-sonnet-4-6',
        candidates: ANTHROPIC,
      }),
    ).toBeNull();
  });

  it('no suggestion when the only lighter options are floored out', () => {
    expect(
      suggestLighterModel({
        provider: 'anthropic',
        current: 'claude-sonnet-4-6',
        candidates: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
      }),
    ).toBeNull();
  });

  it('codex: GPT-5.5 → GPT-5.4 (small weight gaps no longer block tier drops)', () => {
    expect(
      suggestLighterModel({ provider: 'codex', current: 'gpt-5.5', candidates: CODEX })?.id,
    ).toBe('gpt-5.6-terra');
  });

  it('codex: GPT-5.5 costs about 2x GPT-5.4', () => {
    expect(
      suggestLighterModel({ provider: 'codex', current: 'gpt-5.5', candidates: CODEX }),
    ).toEqual({
      id: 'gpt-5.6-terra',
      kind: 'strong',
      costMultiplier: 2,
    });
  });

  it('gemini: Pro has no mid tier, so no suggestion instead of falling to Flash', () => {
    expect(
      suggestLighterModel({ provider: 'gemini', current: 'gemini-3.1-pro', candidates: GEMINI }),
    ).toBeNull();
  });
});

describe('suggestHeavierModel', () => {
  it('Opus 4.8 → Fable 5, optional within the expensive tier, about 2x cost', () => {
    expect(
      suggestHeavierModel({
        provider: 'anthropic',
        current: 'claude-opus-4-8',
        candidates: ANTHROPIC,
      }),
    ).toEqual({
      id: 'claude-fable-5',
      kind: 'optional',
      costMultiplier: 2,
    });
  });

  it('Haiku 4.5 → Sonnet 4.6, strong escalation out of the cheap tier', () => {
    expect(
      suggestHeavierModel({
        provider: 'anthropic',
        current: 'claude-haiku-4-5',
        candidates: ['claude-haiku-4-5', 'claude-sonnet-4-6'],
      }),
    ).toEqual({
      id: 'claude-sonnet-4-6',
      kind: 'strong',
      costMultiplier: 3,
    });
  });

  it('Sonnet 4.6 → Fable 5 (heavy task escalates straight to the top)', () => {
    expect(
      suggestHeavierModel({
        provider: 'anthropic',
        current: 'claude-sonnet-4-6',
        candidates: ANTHROPIC,
      })?.id,
    ).toBe('claude-fable-5');
  });

  it('no suggestion when already on the top model', () => {
    expect(
      suggestHeavierModel({
        provider: 'anthropic',
        current: 'claude-fable-5',
        candidates: ANTHROPIC,
      }),
    ).toBeNull();
  });

  it('codex: GPT-5.4 → GPT-5.5', () => {
    expect(
      suggestHeavierModel({ provider: 'codex', current: 'gpt-5.6-terra', candidates: CODEX })?.id,
    ).toBe('gpt-5.5');
  });

  it('codex: GPT-5.5 costs about 2x GPT-5.4', () => {
    expect(
      suggestHeavierModel({ provider: 'codex', current: 'gpt-5.6-terra', candidates: CODEX }),
    ).toEqual({
      id: 'gpt-5.5',
      kind: 'strong',
      costMultiplier: 2,
    });
  });

  it('Sonnet 4.6 → Fable 5, strong, about 3.3x cost', () => {
    expect(
      suggestHeavierModel({
        provider: 'anthropic',
        current: 'claude-sonnet-4-6',
        candidates: ANTHROPIC,
      }),
    ).toEqual({
      id: 'claude-fable-5',
      kind: 'strong',
      costMultiplier: 3.3,
    });
  });

  it('same-price models within a tier: costMultiplier is null (ratio rounds to 1.0)', () => {
    expect(
      suggestHeavierModel({
        provider: 'anthropic',
        current: 'claude-sonnet-4-5',
        candidates: ['claude-sonnet-4-5', 'claude-sonnet-4-6'],
      }),
    ).toEqual({
      id: 'claude-sonnet-4-6',
      kind: 'strong',
      costMultiplier: null,
    });
  });

  it('gemini: Flash → Pro', () => {
    expect(
      suggestHeavierModel({ provider: 'gemini', current: 'gemini-3.8-flash', candidates: GEMINI })
        ?.id,
    ).toBe('gemini-3.1-pro');
  });

  it('never downgrades the cost tier to gain weight', () => {
    expect(
      suggestHeavierModel({ provider: 'gemini', current: 'gemini-3.1-pro', candidates: GEMINI }),
    ).toBeNull();
  });
});
