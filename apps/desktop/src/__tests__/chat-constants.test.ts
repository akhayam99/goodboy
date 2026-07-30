import { describe, expect, it } from 'vitest';
import {
  parseModelId,
  suggestHeavierModel,
  suggestLighterModel,
} from '../features/chat/utils/chat-constants';

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

const CODEX = ['gpt-5.4-mini', 'gpt-5.2', 'gpt-5.3-codex', 'gpt-5.4', 'gpt-5.5'];

const GEMINI = ['gemini-3.5-flash', 'gemini-3.1-pro'];

describe('suggestLighterModel', () => {
  it('Opus 4.8 → Sonnet 4.6, strong, about 1.7x cheaper', () => {
    expect(suggestLighterModel('claude-opus-4-8', ANTHROPIC)).toEqual({
      id: 'claude-sonnet-4-6',
      kind: 'strong',
      costMultiplier: 1.7,
    });
  });

  it('Opus 5 → Sonnet 4.6, strong, about 1.7x cheaper', () => {
    expect(suggestLighterModel('claude-opus-5', ANTHROPIC)).toEqual({
      id: 'claude-sonnet-4-6',
      kind: 'strong',
      costMultiplier: 1.7,
    });
  });

  it('Fable 5 → Sonnet 4.6 (top tier drops to mid, never to cheap)', () => {
    expect(suggestLighterModel('claude-fable-5', ANTHROPIC)?.id).toBe('claude-sonnet-4-6');
  });

  it('never suggests below the cheap-tier floor', () => {
    expect(suggestLighterModel('claude-opus-4-8', ANTHROPIC)?.id).not.toMatch(/haiku/);
  });

  it('no nag when already mid-tier (cheap tier is floored out)', () => {
    expect(suggestLighterModel('claude-sonnet-4-6', ANTHROPIC)).toBeNull();
  });

  it('no suggestion when the only lighter options are floored out', () => {
    expect(
      suggestLighterModel('claude-sonnet-4-6', ['claude-sonnet-4-6', 'claude-haiku-4-5']),
    ).toBeNull();
  });

  it('codex: GPT-5.5 → GPT-5.4 (small weight gaps no longer block tier drops)', () => {
    expect(suggestLighterModel('gpt-5.5', CODEX)?.id).toBe('gpt-5.4');
  });

  it('codex: GPT-5.5 costs about 2x GPT-5.4', () => {
    expect(suggestLighterModel('gpt-5.5', CODEX)).toEqual({
      id: 'gpt-5.4',
      kind: 'strong',
      costMultiplier: 2,
    });
  });

  it('gemini: Pro has no mid tier, so no suggestion instead of falling to Flash', () => {
    expect(suggestLighterModel('gemini-3.1-pro', GEMINI)).toBeNull();
  });
});

describe('suggestHeavierModel', () => {
  it('Opus 4.8 → Fable 5, optional within the expensive tier, about 2x cost', () => {
    expect(suggestHeavierModel('claude-opus-4-8', ANTHROPIC)).toEqual({
      id: 'claude-fable-5',
      kind: 'optional',
      costMultiplier: 2,
    });
  });

  it('Haiku 4.5 → Sonnet 4.6, strong escalation out of the cheap tier', () => {
    expect(
      suggestHeavierModel('claude-haiku-4-5', ['claude-haiku-4-5', 'claude-sonnet-4-6']),
    ).toEqual({
      id: 'claude-sonnet-4-6',
      kind: 'strong',
      costMultiplier: 3,
    });
  });

  it('Sonnet 4.6 → Fable 5 (heavy task escalates straight to the top)', () => {
    expect(suggestHeavierModel('claude-sonnet-4-6', ANTHROPIC)?.id).toBe('claude-fable-5');
  });

  it('no suggestion when already on the top model', () => {
    expect(suggestHeavierModel('claude-fable-5', ANTHROPIC)).toBeNull();
  });

  it('codex: GPT-5.4 → GPT-5.5', () => {
    expect(suggestHeavierModel('gpt-5.4', CODEX)?.id).toBe('gpt-5.5');
  });

  it('codex: GPT-5.5 costs about 2x GPT-5.4', () => {
    expect(suggestHeavierModel('gpt-5.4', CODEX)).toEqual({
      id: 'gpt-5.5',
      kind: 'strong',
      costMultiplier: 2,
    });
  });

  it('Sonnet 4.6 → Fable 5, strong, about 3.3x cost', () => {
    expect(suggestHeavierModel('claude-sonnet-4-6', ANTHROPIC)).toEqual({
      id: 'claude-fable-5',
      kind: 'strong',
      costMultiplier: 3.3,
    });
  });

  it('same-price models within a tier: costMultiplier is null (ratio rounds to 1.0)', () => {
    expect(
      suggestHeavierModel('claude-sonnet-4-5', ['claude-sonnet-4-5', 'claude-sonnet-4-6']),
    ).toEqual({
      id: 'claude-sonnet-4-6',
      kind: 'strong',
      costMultiplier: null,
    });
  });

  it('gemini: Flash → Pro', () => {
    expect(suggestHeavierModel('gemini-3.5-flash', GEMINI)?.id).toBe('gemini-3.1-pro');
  });

  it('never downgrades the cost tier to gain weight', () => {
    expect(suggestHeavierModel('gemini-3.1-pro', GEMINI)).toBeNull();
  });
});

describe('parseModelId', () => {
  it('single-segment opus version keeps the opus subfamily', () => {
    expect(parseModelId('claude-opus-5')).toEqual({
      family: 'claude',
      subfamily: 'opus',
      variantLabel: '5',
    });
  });

  it('canonical anthropic ids: family/subfamily/variant', () => {
    expect(parseModelId('claude-haiku-4-5')).toEqual({
      family: 'claude',
      subfamily: 'haiku',
      variantLabel: '4.5',
    });
    expect(parseModelId('claude-sonnet-4-6')).toEqual({
      family: 'claude',
      subfamily: 'sonnet',
      variantLabel: '4.6',
    });
    expect(parseModelId('claude-opus-4-7')).toEqual({
      family: 'claude',
      subfamily: 'opus',
      variantLabel: '4.7',
    });
  });

  it('cursor anthropic naming (version-first)', () => {
    expect(parseModelId('claude-4.6-sonnet-medium')).toEqual({
      family: 'claude',
      subfamily: 'sonnet',
      variantLabel: '4.6 medium',
    });
    expect(parseModelId('claude-4.6-sonnet-medium-thinking')).toEqual({
      family: 'claude',
      subfamily: 'sonnet',
      variantLabel: '4.6 medium thinking',
    });
    expect(parseModelId('claude-opus-5-thinking-high')).toEqual({
      family: 'claude',
      subfamily: 'opus',
      variantLabel: '5 high',
    });
  });

  it('cursor opus thinking-high keeps its effort suffix in the variant label', () => {
    expect(parseModelId('claude-opus-4-7-thinking-high')).toEqual({
      family: 'claude',
      subfamily: 'opus',
      variantLabel: '4.7 high',
    });
  });

  it('composer family', () => {
    expect(parseModelId('composer-2.5')).toEqual({
      family: 'composer',
      subfamily: 'Composer',
      variantLabel: '2.5',
    });
    expect(parseModelId('composer-2.5-fast')).toEqual({
      family: 'composer',
      subfamily: null,
      variantLabel: '2.5 Fast',
    });
  });

  it('cursor auto', () => {
    expect(parseModelId('auto')).toEqual({
      family: 'cursor-auto',
      subfamily: null,
      variantLabel: 'Auto',
    });
  });

  it('cursor gpt variants group under the gpt-5 subfamily', () => {
    expect(parseModelId('gpt-5.5-high')).toEqual({
      family: 'gpt',
      subfamily: 'gpt-5',
      variantLabel: '5.5 high',
    });
    expect(parseModelId('gpt-5.5-medium')).toEqual({
      family: 'gpt',
      subfamily: 'gpt-5',
      variantLabel: '5.5 medium',
    });
  });

  it('codex coding models group under the codex subfamily', () => {
    expect(parseModelId('gpt-5.3-codex')).toEqual({
      family: 'gpt',
      subfamily: 'Codex',
      variantLabel: '5.3',
    });
  });

  it('codex turn-tier models cluster under gpt-5 / mini subfamilies', () => {
    expect(parseModelId('gpt-5.4-mini')).toEqual({
      family: 'gpt',
      subfamily: 'Mini',
      variantLabel: '5.4',
    });
    expect(parseModelId('gpt-5.5')).toEqual({
      family: 'gpt',
      subfamily: 'GPT',
      variantLabel: '5.5',
    });
  });

  it('provider/model prefix, strips the provider prefix before parsing', () => {
    expect(parseModelId('anthropic/claude-sonnet-4-6')).toEqual({
      family: 'claude',
      subfamily: 'sonnet',
      variantLabel: '4.6',
    });
    expect(parseModelId('github-copilot/gpt-5.4')).toEqual({
      family: 'gpt',
      subfamily: 'GPT',
      variantLabel: '5.4',
    });
  });

  it('falls back to other for unknown shapes', () => {
    const parsed = parseModelId('something-weird');
    expect(parsed.family).toBe('other');
    expect(parsed.subfamily).toBeNull();
  });
});
