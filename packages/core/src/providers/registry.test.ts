import { describe, expect, it } from 'vitest';
import { ClaudeAdapter } from './claude/adapter';
import { CursorAdapter } from './cursor/adapter';
import { CodexAdapter } from './codex/adapter';
import { GeminiAdapter } from './gemini/adapter';
import { OpenCodeAdapter } from './opencode/adapter';
import {
  UnknownProviderError,
  createProvider,
  getCapabilities,
  listSupportedProviders,
} from './registry';
import { getDefaultTurnModel } from './capabilities';
import { GEMINI_DEFAULT_MODEL } from './gemini/constants';

describe('listSupportedProviders', () => {
  it('returns all provider ids', () => {
    expect(listSupportedProviders()).toEqual([
      'anthropic',
      'cursor',
      'codex',
      'gemini',
      'opencode',
      'openrouter',
      'moonshot',
    ]);
  });

  it('result is readonly array', () => {
    const result = listSupportedProviders();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('createProvider', () => {
  it('returns ClaudeAdapter for anthropic', () => {
    const adapter = createProvider('anthropic');
    expect(adapter).toBeInstanceOf(ClaudeAdapter);
    expect(adapter.id).toBe('anthropic');
  });

  it('returns CursorAdapter for cursor', () => {
    const adapter = createProvider('cursor');
    expect(adapter).toBeInstanceOf(CursorAdapter);
    expect(adapter.id).toBe('cursor');
  });

  it('returns CodexAdapter for codex', () => {
    const adapter = createProvider('codex');
    expect(adapter).toBeInstanceOf(CodexAdapter);
    expect(adapter.id).toBe('codex');
  });

  it('returns GeminiAdapter for gemini', () => {
    const adapter = createProvider('gemini');
    expect(adapter).toBeInstanceOf(GeminiAdapter);
    expect(adapter.id).toBe('gemini');
  });

  it('returns OpenCodeAdapter for opencode, openrouter and moonshot', () => {
    const opencode = createProvider('opencode');
    const openrouter = createProvider('openrouter');
    const moonshot = createProvider('moonshot');
    expect(opencode).toBeInstanceOf(OpenCodeAdapter);
    expect(opencode.id).toBe('opencode');
    expect(openrouter).toBeInstanceOf(OpenCodeAdapter);
    expect(openrouter.id).toBe('openrouter');
    expect(moonshot).toBeInstanceOf(OpenCodeAdapter);
    expect(moonshot.id).toBe('moonshot');
  });

  it('passes deps through to adapter', () => {
    const binary = '/custom/claude-bin';
    const adapter = createProvider('anthropic', { binary });
    expect(adapter).toBeInstanceOf(ClaudeAdapter);
  });

  it('throws UnknownProviderError for unknown id', () => {
    expect(() => createProvider('unknown' as never)).toThrow(UnknownProviderError);
    expect(() => createProvider('unknown' as never)).toThrow('unknown provider: unknown');
  });
});

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
    expect(getDefaultTurnModel({ id: 'gemini' })).toBe('gemini-3.5-flash');
  });

  it('getDefaultTurnModel for anthropic returns the newest opus', () => {
    expect(getDefaultTurnModel({ id: 'anthropic' })).toBe('opus-5');
  });

  it('getDefaultTurnModel for cursor returns the composer turn model', () => {
    expect(getDefaultTurnModel({ id: 'cursor' })).toBe('composer-2.5');
  });

  it('all models have required fields', () => {
    for (const id of listSupportedProviders()) {
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
    expect(codex.models.find((model) => model.id === 'gpt-5.4')?.contextWindow).toBe(400_000);
  });
});
