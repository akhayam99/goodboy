import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, aggregateConfig, clampEffort, configFor, sameConfig } from './config';

describe('ResolveBoard config', () => {
  it('clampEffort keeps supported levels and falls back to the top for unsupported ones', () => {
    expect(clampEffort('claude-sonnet-4-5', 'high')).toBe('high');
    expect(clampEffort('claude-sonnet-4-5', 'max')).toBe('high');
    expect(clampEffort('claude-opus-4-5', 'max')).toBe('max');
    expect(clampEffort('gpt-5-codex', 'max')).toBe('max');
  });

  it('configFor seeds the resolver default model for anthropic', () => {
    expect(configFor('anthropic')).toEqual(DEFAULT_CONFIG);
  });

  it('configFor uses the provider default model for non-anthropic', () => {
    const cfg = configFor('codex');
    expect(cfg.provider).toBe('codex');
    expect(cfg.model).not.toBe(DEFAULT_CONFIG.model);
  });

  it('sameConfig compares provider, model and effort', () => {
    expect(sameConfig(DEFAULT_CONFIG, { ...DEFAULT_CONFIG })).toBe(true);
    expect(sameConfig(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, effort: 'high' })).toBe(false);
  });

  it('aggregateConfig returns the shared config when uniform, else mixed', () => {
    expect(aggregateConfig([DEFAULT_CONFIG, { ...DEFAULT_CONFIG }])).toEqual(DEFAULT_CONFIG);
    expect(aggregateConfig([DEFAULT_CONFIG, { ...DEFAULT_CONFIG, model: 'claude-opus-4-5' }])).toBe(
      'mixed',
    );
    expect(aggregateConfig([])).toEqual(DEFAULT_CONFIG);
  });
});
