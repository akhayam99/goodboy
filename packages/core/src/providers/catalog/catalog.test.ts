import { describe, expect, it } from 'vitest';
import {
  ALL_EFFORTS,
  MODEL_CATALOG,
  entryByCliId,
  listEfforts,
  listEntries,
  listVersions,
  resolveCursorEntry,
  versionWeight,
} from './index';
import type { ModelEntry } from './types';

describe('versionWeight', () => {
  it('orders dotted versions newest-first', () => {
    expect(versionWeight('4.7')).toBeGreaterThan(versionWeight('4.6'));
    expect(versionWeight('5.5')).toBeGreaterThan(versionWeight('5.4'));
  });

  it('handles dashed variants', () => {
    expect(versionWeight('5.4-mini')).toBeGreaterThan(versionWeight('5.3-codex'));
  });

  it('treats integer version as minor=0', () => {
    expect(versionWeight('5')).toBe(versionWeight('5.0'));
  });
});

describe('MODEL_CATALOG: anthropic', () => {
  it('exposes opus 4.7 + 4.6, sonnet 4.6 + 4.5, haiku 4.5', () => {
    const ids = MODEL_CATALOG.anthropic.map((e) => e.baseCliId);
    expect(ids).toContain('claude-opus-4-7');
    expect(ids).toContain('claude-opus-4-6');
    expect(ids).toContain('claude-sonnet-4-6');
    expect(ids).toContain('claude-sonnet-4-5');
    expect(ids).toContain('claude-haiku-4-5');
  });

  it('opus 4.7 supports the full max-tier effort scale', () => {
    const e = entryByCliId('anthropic', 'claude-opus-4-7');
    expect(e).not.toBeNull();
    expect(e!.supportedEfforts).toEqual(['low', 'medium', 'high', 'extra-high', 'max']);
  });

  it('haiku exposes no effort axis', () => {
    const e = entryByCliId('anthropic', 'claude-haiku-4-5');
    expect(e!.supportedEfforts).toBeNull();
  });

  it('opus 4.7 has 1M context, opus 4.6 has 200k', () => {
    expect(entryByCliId('anthropic', 'claude-opus-4-7')!.contextWindow).toBe(1_000_000);
    expect(entryByCliId('anthropic', 'claude-opus-4-6')!.contextWindow).toBe(200_000);
  });
});

describe('MODEL_CATALOG: codex', () => {
  it('exposes the GPT-5 family with effort as orthogonal axis', () => {
    const gpt55 = entryByCliId('codex', 'gpt-5.5');
    expect(gpt55).not.toBeNull();
    expect(gpt55!.supportedEfforts).toContain('high');
    expect(gpt55!.supportedEfforts).toContain('extra-high');
  });

  it('gpt-5.5 has 400k context (was 200k before fix)', () => {
    expect(entryByCliId('codex', 'gpt-5.5')!.contextWindow).toBe(400_000);
  });

  it('gpt-5.4 has 1M context', () => {
    expect(entryByCliId('codex', 'gpt-5.4')!.contextWindow).toBeGreaterThanOrEqual(1_000_000);
  });

  it('gpt-5.3-codex-spark hidden by default (ChatGPT Pro only)', () => {
    const e = entryByCliId('codex', 'gpt-5.3-codex-spark');
    expect(e!.hidden).toBe(true);
  });
});

describe('MODEL_CATALOG: cursor', () => {
  it('contains generated variants for opus 4.7 (effort × thinking × fast)', () => {
    const ids = MODEL_CATALOG.cursor.map((e) => e.baseCliId);
    expect(ids).toContain('claude-opus-4-7-low');
    expect(ids).toContain('claude-opus-4-7-max');
    expect(ids).toContain('claude-opus-4-7-thinking-high');
    expect(ids).toContain('claude-opus-4-7-thinking-max-fast');
  });

  it('contains composer + gemini + grok entries', () => {
    const ids = MODEL_CATALOG.cursor.map((e) => e.baseCliId);
    expect(ids).toContain('composer-2.5');
    expect(ids).toContain('composer-2.5-fast');
    expect(ids).toContain('gemini-3.1-pro');
    expect(ids).toContain('grok-4.3');
  });

  it('contains gpt-5.5 variants with extra-high suffix (Cursor naming)', () => {
    const ids = MODEL_CATALOG.cursor.map((e) => e.baseCliId);
    expect(ids).toContain('gpt-5.5-extra-high');
    expect(ids).toContain('gpt-5.5-extra-high-fast');
  });

  it('resolveCursorEntry finds the right cliId for a (family, version, effort, thinking, fast)', () => {
    const entry = resolveCursorEntry('claude', 'opus', '4.7', {
      effort: 'high',
      thinking: true,
      fast: true,
    });
    expect(entry).not.toBeNull();
    expect(entry!.baseCliId).toBe('claude-opus-4-7-thinking-high-fast');
  });
});

describe('listVersions', () => {
  it('returns claude opus versions newest-first', () => {
    const versions = listVersions('anthropic', 'claude', 'opus');
    expect(versions).toEqual(['4.7', '4.6']);
  });

  it('returns codex GPT base versions newest-first', () => {
    const versions = listVersions('codex', 'gpt', 'gpt');
    expect(versions[0]).toBe('5.5');
  });
});

describe('listEfforts', () => {
  it('claude opus 4.7 returns full effort scale', () => {
    expect(listEfforts('anthropic', 'claude', 'opus', '4.7')).toEqual([
      'low',
      'medium',
      'high',
      'extra-high',
      'max',
    ]);
  });

  it('claude haiku 4.5 returns null (no effort axis)', () => {
    expect(listEfforts('anthropic', 'claude', 'haiku', '4.5')).toBeNull();
  });

  it('cursor gpt 5.5 union covers minimal..xhigh', () => {
    const efforts = listEfforts('cursor', 'gpt', 'gpt', '5.5');
    expect(efforts).toContain('minimal');
    expect(efforts).toContain('extra-high');
  });
});

describe('listEntries: hidden filter', () => {
  it('hides Cursor `auto` entry by default (deprecated, CLI rejects it)', () => {
    const visible = listEntries('cursor').map((e) => e.baseCliId);
    expect(visible).not.toContain('grok-build-0.1');
  });

  it('reveals hidden entries when explicitly requested', () => {
    const all = listEntries('cursor', { includeHidden: true });
    const ids = all.map((e: ModelEntry) => e.baseCliId);
    expect(ids).toContain('composer-1.5');
  });
});

describe('ALL_EFFORTS', () => {
  it('lists every level we render in the picker', () => {
    expect(ALL_EFFORTS).toEqual(['minimal', 'low', 'medium', 'high', 'extra-high', 'max']);
  });
});
