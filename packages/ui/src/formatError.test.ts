import { describe, expect, it } from 'vitest';
import { formatError } from './formatError';

describe('formatError', () => {
  it('extracts .message from Error instance', () => {
    expect(formatError(new Error('boom'))).toBe('boom');
  });

  it('returns string unchanged', () => {
    expect(formatError('plain string')).toBe('plain string');
  });

  it('extracts .message from tauri-style error object', () => {
    const tauriErr = { kind: 'io', message: 'No such file or directory' };
    expect(formatError(tauriErr)).toBe('No such file or directory');
  });

  it('falls back to JSON for objects without .message', () => {
    expect(formatError({ kind: 'mystery', code: 42 })).toContain('"kind"');
  });

  it('returns json for null', () => {
    expect(formatError(null)).toBe('null');
  });

  it('handles non-string message field by JSON-encoding the object', () => {
    expect(formatError({ message: 42 })).toContain('"message"');
  });

  it('never returns "[object Object]" for plain objects', () => {
    expect(formatError({ kind: 'io' })).not.toBe('[object Object]');
  });
});
