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
  const openTerminal = vi.fn();
  const runScript = vi.fn(async (_params: unknown) => ({ exitCode }));
  const action = commandAction({
    sessionId,
    mountId,
    name: 'db:generate',
    command: { text: 'pnpm run db:generate', cwd: '/work/ledger-core', mode, scriptId },
    failureTitle: "Couldn't run db:generate",
    openTerminal,
    runScript,
  });
  return { action, openTerminal, runScript };
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
