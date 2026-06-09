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
  'claude-fable-5',
];

const CODEX = ['gpt-5.4-mini', 'gpt-5.2', 'gpt-5.3-codex', 'gpt-5.4', 'gpt-5.5'];

const GEMINI = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];

describe('suggestLighterModel', () => {
  it('Opus 4.8 → Sonnet 4.6 (drops one cost tier, most capable in it)', () => {
    expect(suggestLighterModel('claude-opus-4-8', ANTHROPIC)).toBe('claude-sonnet-4-6');
  });

  it('Fable 5 → Sonnet 4.6 (top tier drops to mid, never to cheap)', () => {
    expect(suggestLighterModel('claude-fable-5', ANTHROPIC)).toBe('claude-sonnet-4-6');
  });

  it('never suggests below the cheap-tier floor', () => {
    expect(suggestLighterModel('claude-opus-4-8', ANTHROPIC)).not.toMatch(/haiku/);
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
    expect(suggestLighterModel('gpt-5.5', CODEX)).toBe('gpt-5.4');
  });

  it('gemini: Pro has no mid tier, so no suggestion instead of falling to Flash', () => {
    expect(suggestLighterModel('gemini-2.5-pro', GEMINI)).toBeNull();
  });
});

describe('suggestHeavierModel', () => {
  it('Opus 4.8 → Fable 5 (escalates to the strongest same-or-higher tier model)', () => {
    expect(suggestHeavierModel('claude-opus-4-8', ANTHROPIC)).toBe('claude-fable-5');
  });

  it('Sonnet 4.6 → Fable 5 (heavy task escalates straight to the top)', () => {
    expect(suggestHeavierModel('claude-sonnet-4-6', ANTHROPIC)).toBe('claude-fable-5');
  });

  it('no suggestion when already on the top model', () => {
    expect(suggestHeavierModel('claude-fable-5', ANTHROPIC)).toBeNull();
  });

  it('codex: GPT-5.4 → GPT-5.5', () => {
    expect(suggestHeavierModel('gpt-5.4', CODEX)).toBe('gpt-5.5');
  });

  it('gemini: Flash → Pro', () => {
    expect(suggestHeavierModel('gemini-2.5-flash', GEMINI)).toBe('gemini-2.5-pro');
  });

  it('never downgrades the cost tier to gain weight', () => {
    expect(suggestHeavierModel('gemini-2.5-pro', GEMINI)).toBeNull();
  });
});

describe('parseModelId', () => {
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
    expect(parseModelId('claude-4.6-sonnet-high')).toEqual({
      family: 'claude',
      subfamily: 'sonnet',
      variantLabel: '4.6 high',
    });
    expect(parseModelId('claude-4.6-opus-high-thinking')).toEqual({
      family: 'claude',
      subfamily: 'opus',
      variantLabel: '4.6 high thinking',
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
    expect(parseModelId('composer-2')).toEqual({
      family: 'composer',
      subfamily: null,
      variantLabel: '2',
    });
    expect(parseModelId('composer-2-fast')).toEqual({
      family: 'composer',
      subfamily: null,
      variantLabel: '2 Fast',
    });
  });

  it('cursor auto', () => {
    expect(parseModelId('auto')).toEqual({
      family: 'cursor-auto',
      subfamily: null,
      variantLabel: 'auto',
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
      subfamily: 'codex',
      variantLabel: '5.3',
    });
  });

  it('codex turn-tier models cluster under gpt-5 / mini subfamilies', () => {
    expect(parseModelId('gpt-5.4-mini')).toEqual({
      family: 'gpt',
      subfamily: 'mini',
      variantLabel: '5.4',
    });
    expect(parseModelId('gpt-5.5')).toEqual({
      family: 'gpt',
      subfamily: 'gpt-5',
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
      subfamily: '5.4',
      variantLabel: '5.4',
    });
  });

  it('falls back to other for unknown shapes', () => {
    const parsed = parseModelId('something-weird');
    expect(parsed.family).toBe('other');
    expect(parsed.subfamily).toBeNull();
  });
});
