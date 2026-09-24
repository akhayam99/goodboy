import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@goodboy/types';
import { getCapabilities, getDefaultTurnModel } from './capabilities';
import { GEMINI_DEFAULT_MODEL } from './gemini/constants';

describe('getCapabilities', () => {
  it('returns anthropic capabilities with correct flags', () => {
    const caps = getCapabilities({ id: 'anthropic' });
    expect(caps.supportsTools).toBe(true);
    expect(caps.supportsStream).toBe(true);
    expect(caps.supportsCheapModel).toBe(true);
    expect(caps.models.length).toBeGreaterThan(0);
  });

  it('anthropic has a cheap-tier model', () => {
    const caps = getCapabilities({ id: 'anthropic' });
    expect(caps.models.some((m) => m.tier === 'cheap')).toBe(true);
  });

  it('cursor capabilities have models', () => {
    const caps = getCapabilities({ id: 'cursor' });
    expect(caps.models.length).toBeGreaterThan(0);
    expect(caps.models.some((m) => m.tier === 'cheap')).toBe(true);
  });

  it('codex capabilities have models', () => {
    const caps = getCapabilities({ id: 'codex' });
    expect(caps.models.length).toBeGreaterThan(0);
    expect(caps.models.some((m) => m.tier === 'cheap')).toBe(true);
  });

  it('gemini capabilities have models', () => {
    const caps = getCapabilities({ id: 'gemini' });
    expect(caps.models.length).toBeGreaterThan(0);
    expect(caps.models.some((m) => m.tier === 'cheap')).toBe(true);
  });

  it('getDefaultTurnModel for gemini returns the cheap default, not the pro turn model', () => {
    expect(getDefaultTurnModel({ id: 'gemini' })).toBe(GEMINI_DEFAULT_MODEL);
    expect(getDefaultTurnModel({ id: 'gemini' })).toBe('gemini-3.8-flash');
  });

  it('getDefaultTurnModel for anthropic returns the newest opus', () => {
    expect(getDefaultTurnModel({ id: 'anthropic' })).toBe('opus-5');
  });

  it('getDefaultTurnModel for cursor returns the composer turn model', () => {
    expect(getDefaultTurnModel({ id: 'cursor' })).toBe('composer-2.5');
  });

  it('all models have required fields', () => {
    for (const id of PROVIDER_IDS) {
      const caps = getCapabilities({ id });
      for (const model of caps.models) {
        expect(typeof model.id).toBe('string');
        expect(['turn', 'cheap']).toContain(model.tier);
        expect(typeof model.contextWindow).toBe('number');
        expect(model.contextWindow).toBeGreaterThan(0);
      }
    }
  });

  it('exposes authored context windows per model', () => {
    const anthropic = getCapabilities({ id: 'anthropic' });
    const codex = getCapabilities({ id: 'codex' });
    expect(anthropic.models.find((model) => model.id === 'sonnet-4.5')?.contextWindow).toBe(
      200_000,
    );
    expect(anthropic.models.find((model) => model.id === 'sonnet-4.6')?.contextWindow).toBe(
      1_000_000,
    );
    expect(codex.models.find((model) => model.id === 'gpt-5.5')?.contextWindow).toBe(400_000);
  });
});
