import { describe, expect, it } from 'vitest';
import { validateSessionDirectoryName } from './validateSessionDirectoryName';

describe('validateSessionDirectoryName', () => {
  it('accepts letters across scripts, digits, spaces, dashes, underscores, and dots', () => {
    expect(validateSessionDirectoryName({ name: 'gestione finanze 2025' })).toEqual({ ok: true });
    expect(validateSessionDirectoryName({ name: 'MatchAnalysis_20260514' })).toEqual({ ok: true });
    expect(validateSessionDirectoryName({ name: 'План тестирования 2026.08' })).toEqual({
      ok: true,
    });
    expect(validateSessionDirectoryName({ name: '分析 セッション 01' })).toEqual({ ok: true });
  });

  it('rejects separators and double dots', () => {
    expect(validateSessionDirectoryName({ name: 'folder/name' })).toEqual({
      ok: false,
      kind: 'path_separator',
    });
    expect(validateSessionDirectoryName({ name: 'folder\\name' })).toEqual({
      ok: false,
      kind: 'path_separator',
    });
    expect(validateSessionDirectoryName({ name: 'folder..name' })).toEqual({
      ok: false,
      kind: 'dot_dot',
    });
  });

  it('rejects leading dots and trailing dot or space', () => {
    expect(validateSessionDirectoryName({ name: '.hidden' })).toEqual({
      ok: false,
      kind: 'leading_dot',
    });
    expect(validateSessionDirectoryName({ name: 'folder.' })).toEqual({
      ok: false,
      kind: 'trailing_dot_or_space',
    });
    expect(validateSessionDirectoryName({ name: 'folder ' })).toEqual({
      ok: false,
      kind: 'trailing_dot_or_space',
    });
  });

  it('rejects control and reserved Windows characters', () => {
    expect(validateSessionDirectoryName({ name: 'folder\u0007name' })).toEqual({
      ok: false,
      kind: 'control_character',
    });
    expect(validateSessionDirectoryName({ name: 'folder|name' })).toEqual({
      ok: false,
      kind: 'reserved_character',
    });
  });

  it('rejects empty and too-long names', () => {
    expect(validateSessionDirectoryName({ name: '' })).toEqual({ ok: false, kind: 'empty' });
    expect(validateSessionDirectoryName({ name: 'a'.repeat(61) })).toEqual({
      ok: false,
      kind: 'too_long',
    });
  });
});
