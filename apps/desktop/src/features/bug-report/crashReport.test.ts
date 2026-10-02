// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() =>
  vi.fn<(command: string, payload?: unknown) => Promise<undefined>>(async () => undefined),
);

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

const loadCapture = async () => {
  vi.resetModules();
  return import('./crashReport');
};

const writes = () => invoke.mock.calls.filter((call) => call[0] === 'last_crash_write');

const payloadOf = (index: number) => {
  const call: ReadonlyArray<unknown> = writes()[index] ?? [];
  return call[1];
};

beforeEach(() => {
  invoke.mockClear();
});

describe('captureCrash actions', () => {
  it('carries the last shortcut and screen names, never their content', async () => {
    const { installCrashCapture } = await loadCapture();
    const { registerShortcut } = await import('../../shared/keyboard/dispatcher');
    installCrashCapture();
    const stop = registerShortcut('nav.back', () => undefined);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketLeft', ctrlKey: true }));
    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), {
        reason: new Error('send prompt fix the refund for Rowan'),
      }),
    );
    stop();

    expect(payloadOf(0)).toMatchObject({
      crash: { actions: ['screen.board', 'nav.back'] },
    });
  });
});

describe('captureCrash', () => {
  it('writes one redacted crash with our frames and the screen', async () => {
    const { captureCrash } = await loadCapture();

    captureCrash({
      source: 'window',
      message:
        'TypeError: fetch failed with Bearer sk-ant-api03-AbCdEfGhIjKlMnOp at /Users/rowan/x.ts',
      stack: [
        'TypeError: fetch failed',
        '    at Row (/src/Row.tsx:4)',
        '    at renderWithHooks (/node_modules/.vite/deps/react-dom.js:1)',
      ].join('\n'),
    });
    captureCrash({ source: 'promise', message: 'second', stack: null });

    expect(writes()).toHaveLength(1);
    expect(payloadOf(0)).toEqual({
      crash: {
        source: 'window',
        message: expect.not.stringContaining('sk-ant-api03'),
        stack: 'at Row (/src/Row.tsx:4)',
        screen: expect.any(String),
        actions: [],
      },
    });
    expect(JSON.stringify(payloadOf(0))).not.toContain('/Users/rowan');
  });

  it('ignores the resize observer noise', async () => {
    const { captureCrash } = await loadCapture();

    captureCrash({
      source: 'window',
      message: 'ResizeObserver loop completed with undelivered notifications.',
      stack: null,
    });

    expect(writes()).toHaveLength(0);
  });

  it('listens for window errors and unhandled rejections', async () => {
    const { installCrashCapture } = await loadCapture();
    installCrashCapture();

    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), {
        reason: new RangeError('index out of range'),
      }),
    );

    expect(writes()).toHaveLength(1);
    expect(payloadOf(0)).toMatchObject({
      crash: { source: 'promise', message: 'RangeError: index out of range' },
    });
  });

  it('keeps the kind and message of a rejection that is a plain command error object', async () => {
    const { installCrashCapture } = await loadCapture();
    installCrashCapture();

    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), {
        reason: { kind: 'sqlite', message: 'sqlite error: database is locked' },
      }),
    );

    expect(payloadOf(0)).toMatchObject({
      crash: { source: 'promise', message: 'sqlite: sqlite error: database is locked' },
    });
  });

  it('falls back to a generic message for a rejection with no readable message', async () => {
    const { installCrashCapture } = await loadCapture();
    installCrashCapture();

    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: { code: 5 } }));

    expect(payloadOf(0)).toMatchObject({
      crash: { source: 'promise', message: 'Unhandled rejection' },
    });
  });
});
