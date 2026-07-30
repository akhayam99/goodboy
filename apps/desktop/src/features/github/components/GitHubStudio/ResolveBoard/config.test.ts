import { describe, expect, it } from 'vitest';
import { clampEffort } from '../../../../chat/utils/chat-constants';
import { aggregateConfig, configFor, defaultConfig, sameConfig } from './config';

const DEFAULT_CONFIG = defaultConfig({ roleModels: null });

describe('ResolveBoard config', () => {
  it('clampEffort keeps supported levels and falls back to the top for unsupported ones', () => {
    expect(clampEffort('claude-sonnet-4-5', 'high')).toBe('high');
    expect(clampEffort('claude-sonnet-4-5', 'max')).toBe('high');
    expect(clampEffort('claude-opus-4-5', 'max')).toBe('max');
    expect(clampEffort('gpt-5-codex', 'max')).toBe('high');
    expect(clampEffort('gpt-5.5', 'max')).toBe('xhigh');
    expect(clampEffort('gpt-5.5', 'minimal')).toBe('low');
  });

  it('defaultConfig seeds fix mode with an empty hint', () => {
    expect(DEFAULT_CONFIG.mode).toBe('fix');
    expect(DEFAULT_CONFIG.hint).toBe('');
  });

  it('configFor seeds the resolver default model for anthropic', () => {
    expect(configFor({ provider: 'anthropic', base: DEFAULT_CONFIG })).toEqual(DEFAULT_CONFIG);
  });

  it('configFor uses the provider default model and keeps mode and hint', () => {
    const cfg = configFor({
      provider: 'codex',
      base: { ...DEFAULT_CONFIG, mode: 'analyze', hint: 'careful' },
    });
    expect(cfg.provider).toBe('codex');
    expect(cfg.model).not.toBe(DEFAULT_CONFIG.model);
    expect(cfg.mode).toBe('analyze');
    expect(cfg.hint).toBe('careful');
  });

  it('sameConfig compares routing, mode and hint', () => {
    expect(sameConfig(DEFAULT_CONFIG, { ...DEFAULT_CONFIG })).toBe(true);
    expect(sameConfig(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, effort: 'high' })).toBe(false);
    expect(sameConfig(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, mode: 'analyze' })).toBe(false);
    expect(sameConfig(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, hint: 'x' })).toBe(false);
  });

  it('aggregateConfig returns the shared config when uniform, else mixed', () => {
    expect(
      aggregateConfig({
        configs: [DEFAULT_CONFIG, { ...DEFAULT_CONFIG }],
        fallback: DEFAULT_CONFIG,
      }),
    ).toEqual(DEFAULT_CONFIG);
    expect(
      aggregateConfig({
        configs: [DEFAULT_CONFIG, { ...DEFAULT_CONFIG, model: 'claude-opus-4-5' }],
        fallback: DEFAULT_CONFIG,
      }),
    ).toBe('mixed');
    expect(aggregateConfig({ configs: [], fallback: DEFAULT_CONFIG })).toEqual(DEFAULT_CONFIG);
  });
});
