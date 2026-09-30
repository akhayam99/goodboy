import { describe, expect, it } from 'vitest';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import {
  asEffortLevel,
  asProvider,
  CHAT_PREFIX_RE,
  CHAT_PREFIXES,
  composerPlaceholder,
  VALID_PROVIDERS,
} from './lib';

describe('asEffortLevel', () => {
  it('accepts a valid effort level', () => {
    expect(asEffortLevel('high')).toBe('high');
  });

  it('rejects an unknown value', () => {
    expect(asEffortLevel('bogus')).toBeNull();
  });

  it('rejects null and empty input', () => {
    expect(asEffortLevel(null)).toBeNull();
    expect(asEffortLevel('')).toBeNull();
  });
});

describe('asProvider', () => {
  it('accepts a valid provider', () => {
    expect(asProvider('anthropic')).toBe('anthropic');
  });

  it('rejects a provider not in the allow list', () => {
    expect(asProvider('openai')).toBeNull();
  });

  it('rejects null input', () => {
    expect(asProvider(null)).toBeNull();
  });
});

describe('VALID_PROVIDERS', () => {
  it('keeps its order', () => {
    expect(VALID_PROVIDERS).toEqual([
      'anthropic',
      'cursor',
      'codex',
      'gemini',
      'opencode',
      'openrouter',
      'moonshot',
    ]);
  });
});

describe('CHAT_PREFIX_RE', () => {
  it('matches single-token command prefixes', () => {
    expect(CHAT_PREFIX_RE.test('$build')).toBe(true);
    expect(CHAT_PREFIX_RE.test('~workflow')).toBe(true);
    expect(CHAT_PREFIX_RE.test('@agent')).toBe(true);
  });

  it('does not recognise / as a live prefix while WORKSPACE_FEATURES.skills is off', () => {
    expect(WORKSPACE_FEATURES.skills).toBe(false);
    expect(CHAT_PREFIX_RE.test('/cmd')).toBe(false);
  });

  it('accepts every prefix the grammar advertises', () => {
    for (const prefix of CHAT_PREFIXES) {
      expect(CHAT_PREFIX_RE.test(`${prefix.symbol}x`), prefix.symbol).toBe(true);
    }
  });

  it('tolerates leading whitespace', () => {
    expect(CHAT_PREFIX_RE.test('  $build')).toBe(true);
  });

  it('rejects plain text', () => {
    expect(CHAT_PREFIX_RE.test('hello')).toBe(false);
  });

  it('rejects a prefix followed by a space and more text', () => {
    expect(CHAT_PREFIX_RE.test('$build now')).toBe(false);
  });
});

describe('composerPlaceholder', () => {
  it('leads with the first-message prompt over any other state', () => {
    expect(
      composerPlaceholder({
        isRunning: true,
        firstMessagePrompt: 'What should Scout look into?',
        roleLabel: 'Scout',
      }),
    ).toBe('What should Scout look into?');
  });

  it('asks to reply to the role once a first message exists', () => {
    expect(
      composerPlaceholder({ isRunning: false, firstMessagePrompt: null, roleLabel: 'Implementer' }),
    ).toBe('Reply to Implementer');
  });

  it('asks to queue a message while the turn runs', () => {
    expect(
      composerPlaceholder({ isRunning: true, firstMessagePrompt: null, roleLabel: 'Implementer' }),
    ).toBe('Queue a message for Implementer');
  });

  it('never carries prefix syntax, learned from the + menu instead', () => {
    const placeholder = composerPlaceholder({
      isRunning: false,
      firstMessagePrompt: null,
      roleLabel: 'Implementer',
    });
    for (const prefix of CHAT_PREFIXES) {
      expect(placeholder).not.toContain(prefix.symbol);
    }
  });

  it('drops the role when none is known', () => {
    expect(
      composerPlaceholder({ isRunning: false, firstMessagePrompt: null, roleLabel: null }),
    ).toBe('Reply');
  });
});
