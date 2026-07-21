import { describe, expect, it } from 'vitest';
import { ClaudeAdapter } from './claude/adapter';
import { CursorAdapter } from './cursor/adapter';
import { CodexAdapter } from './codex/adapter';
import { GeminiAdapter } from './gemini/adapter';
import {
  UnknownProviderError,
  createProvider,
  getCapabilities,
  listSupportedProviders,
} from './registry';
import { getDefaultTurnModel } from './capabilities';
import { GEMINI_DEFAULT_MODEL } from './gemini/constants';

describe('listSupportedProviders', () => {
  it('returns all four provider ids', () => {
    expect(listSupportedProviders()).toEqual(['anthropic', 'cursor', 'codex', 'gemini']);
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
    const caps = getCapabilities('anthropic');
    expect(caps.supportsTools).toBe(true);
    expect(caps.supportsStream).toBe(true);
    expect(caps.supportsCheapModel).toBe(true);
    expect(caps.models.length).toBeGreaterThan(0);
  });

  it('anthropic has a cheap-tier model', () => {
    const caps = getCapabilities('anthropic');
    expect(caps.models.some((m) => m.tier === 'cheap')).toBe(true);
  });

  it('cursor capabilities have models', () => {
    const caps = getCapabilities('cursor');
    expect(caps.models.length).toBeGreaterThan(0);
    expect(caps.models.some((m) => m.tier === 'cheap')).toBe(true);
  });

  it('codex capabilities have models', () => {
    const caps = getCapabilities('codex');
    expect(caps.models.length).toBeGreaterThan(0);
    expect(caps.models.some((m) => m.tier === 'cheap')).toBe(true);
  });

  it('gemini capabilities have models', () => {
    const caps = getCapabilities('gemini');
    expect(caps.models.length).toBeGreaterThan(0);
    expect(caps.models.some((m) => m.tier === 'cheap')).toBe(true);
  });

  it('getDefaultTurnModel for gemini returns the cheap default, not the pro turn model', () => {
    expect(getDefaultTurnModel('gemini')).toBe(GEMINI_DEFAULT_MODEL);
    expect(getDefaultTurnModel('gemini')).toBe('gemini-3.5-flash');
  });

  it('getDefaultTurnModel for cursor returns the composer turn model', () => {
    expect(getDefaultTurnModel('cursor')).toBe('composer-2');
  });

  it('all models have required fields', () => {
    for (const id of listSupportedProviders()) {
      const caps = getCapabilities(id);
      for (const model of caps.models) {
        expect(typeof model.id).toBe('string');
        expect(['turn', 'cheap']).toContain(model.tier);
        expect(typeof model.contextWindow).toBe('number');
        expect(model.contextWindow).toBeGreaterThan(0);
      }
    }
  });
});
