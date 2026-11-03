// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDemoOverlay } from './addDemoOverlay';

const base = vi.fn(async (command: string) => `base:${command}`);

beforeEach(() => {
  Reflect.set(window, '__TAURI_INTERNALS__', { invoke: base });
});

afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  base.mockClear();
});

const invokeOf = (): ((command: string) => Promise<unknown>) =>
  Reflect.get(Reflect.get(window, '__TAURI_INTERNALS__'), 'invoke');

describe('addDemoOverlay', () => {
  it('answers a listed command and sends every other command to the earlier handler', async () => {
    addDemoOverlay({ answers: { worktree_diff: 'patch' } });

    expect(await invokeOf()('worktree_diff')).toBe('patch');
    expect(await invokeOf()('worktree_diff_file')).toBe('base:worktree_diff_file');
  });

  it('keeps the answers of an earlier overlay when a second one is added', async () => {
    addDemoOverlay({ answers: { worktree_diff: 'patch' } });
    addDemoOverlay({ answers: { worktree_status: 'behind' } });

    expect(await invokeOf()('worktree_diff')).toBe('patch');
    expect(await invokeOf()('worktree_status')).toBe('behind');
    expect(await invokeOf()('anything_else')).toBe('base:anything_else');
  });
});
