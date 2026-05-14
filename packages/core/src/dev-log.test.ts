import { afterEach, describe, expect, it, vi } from 'vitest';
import { devWarn } from './dev-log';

describe('devWarn', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  afterEach(() => {
    warnSpy.mockClear();
  });

  it('does not throw when `process` is undefined (browser/webview)', () => {
    const original = globalThis.process;
    delete (globalThis as { process?: unknown }).process;
    try {
      expect(() => devWarn('hello')).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith('hello');
    } finally {
      globalThis.process = original;
    }
  });

  it('warns when NODE_ENV is undefined', () => {
    devWarn('first');
    expect(warnSpy).toHaveBeenCalledWith('first');
  });

  it('silent when NODE_ENV === production', () => {
    const prev = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      devWarn('shhh');
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      process.env['NODE_ENV'] = prev;
    }
  });
});
