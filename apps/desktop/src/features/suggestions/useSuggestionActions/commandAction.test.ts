// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { commandAction } from './commandAction';

const sessionId = brandId<SessionId>({ value: 'session-harborline' });
const mountId = brandId<MountId>({ value: 'mount-ledger-core' });

type Setup = {
  readonly mode: 'type' | 'run';
  readonly exitCode?: number;
  readonly scriptId?: string | null;
};

const setup = ({ mode, exitCode = 0, scriptId = null }: Setup) => {
  const openTerminal = vi.fn(() => 'terminal-1');
  const trackTyped = vi.fn();
  const runScript = vi.fn(async (_params: unknown) => ({ exitCode }));
  const action = commandAction({
    sessionId,
    mountId,
    name: 'db:generate',
    command: { text: 'pnpm run db:generate', cwd: '/work/ledger-core', mode, scriptId },
    failureTitle: "Couldn't run db:generate",
    openTerminal,
    trackTyped,
    runScript,
  });
  return { action, openTerminal, trackTyped, runScript };
};

describe('commandAction', () => {
  it('writes a typed command into the terminal of the worktree and presses no Enter', async () => {
    const { action, openTerminal, runScript } = setup({ mode: 'type' });
    expect(action?.label).toBe('Add to prompt');
    await action?.run();
    expect(openTerminal).toHaveBeenCalledWith({
      cwd: '/work/ledger-core',
      prefill: 'pnpm run db:generate',
    });
    expect(runScript).not.toHaveBeenCalled();
  });

  it('follows the typed command of a script so its exit can settle the move', async () => {
    const { action, trackTyped } = setup({ mode: 'type', scriptId: 'script-db-migrate' });
    await action?.run();
    expect(trackTyped).toHaveBeenCalledWith({
      sessionId,
      terminalId: 'terminal-1',
      scriptId: 'script-db-migrate',
      name: 'db:generate',
      command: 'pnpm run db:generate',
      mountId,
    });
  });

  it('follows nothing when the typed command is no script', async () => {
    const { action, trackTyped } = setup({ mode: 'type' });
    await action?.run();
    expect(trackTyped).not.toHaveBeenCalled();
  });

  it('runs a safe script on the click, in its worktree and mount', async () => {
    const { action, openTerminal, runScript } = setup({
      mode: 'run',
      scriptId: 'next-script:db:generate',
    });
    expect(action?.label).toBe('Run');
    await action?.run();
    expect(runScript).toHaveBeenCalledWith({
      sessionId,
      scriptId: 'next-script:db:generate',
      name: 'db:generate',
      command: 'pnpm run db:generate',
      cwd: '/work/ledger-core',
      mountId,
    });
    expect(openTerminal).not.toHaveBeenCalled();
  });

  it('fails when the script exits non-zero, and Retry runs it again', async () => {
    const { action, runScript } = setup({ mode: 'run', exitCode: 2 });
    await expect(action?.run()).rejects.toThrow('db:generate exited with code 2');
    await expect(action?.run()).rejects.toThrow('db:generate exited with code 2');
    expect(runScript).toHaveBeenCalledTimes(2);
  });
});
