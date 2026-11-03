// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { describe, expect, it, vi } from 'vitest';
import { addDemoOverlay } from './addDemoOverlay';
import { installDemoIpc } from './installDemoIpc';

const invokeOf = (): ((command: string) => Promise<unknown>) =>
  Reflect.get(Reflect.get(window, '__TAURI_INTERNALS__'), 'invoke');

describe('addDemoOverlay on the demo dispatcher', () => {
  it('answers a listed command and lets the dispatcher handle a miss without looping', async () => {
    installDemoIpc();
    addDemoOverlay({ answers: { worktree_diff: 'patch' } });

    expect(await invokeOf()('worktree_diff')).toBe('patch');
    expect(await invokeOf()('detect_editors')).toEqual([]);
  });

  it('keeps every overlay answering when a second one is added', async () => {
    installDemoIpc();
    addDemoOverlay({ answers: { worktree_diff: 'patch' } });
    addDemoOverlay({ answers: { worktree_status: 'behind' } });

    expect(await invokeOf()('worktree_diff')).toBe('patch');
    expect(await invokeOf()('worktree_status')).toBe('behind');
    expect(await invokeOf()('detect_editors')).toEqual([]);
  });
});
