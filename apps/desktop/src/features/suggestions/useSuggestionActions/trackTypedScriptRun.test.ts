// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import type { LiveTerminal } from '../../terminal/terminal';
import { trackTypedScriptRun } from './trackTypedScriptRun';

const sessionId = brandId<SessionId>({ value: 'session-harborline' });
const mountId = brandId<MountId>({ value: 'mount-ledger-core' });

const terminalOf = (overrides: Partial<LiveTerminal> = {}): LiveTerminal => ({
  id: 'terminal-1',
  cwd: '/work/ledger-core',
  pid: 100,
  foregroundPid: 100,
  lastExitCode: null,
  lastExitCommand: null,
  ...overrides,
});

type Reads = ReadonlyArray<LiveTerminal>;

const setup = ({ reads }: { readonly reads: Array<Reads | Error> }) => {
  const record = vi.fn();
  const onReadFailed = vi.fn();
  const readTerminals = vi.fn(async () => {
    const next = reads.length > 1 ? reads.shift() : reads[0];
    if (next instanceof Error) {
      throw next;
    }
    return next ?? [];
  });
  const stop = trackTypedScriptRun({
    sessionId,
    terminalId: 'terminal-1',
    scriptId: 'script-db-migrate',
    name: 'db:migrate',
    mountId,
    command: 'pnpm run db:migrate',
    readTerminals,
    record,
    onReadFailed,
  });
  return { record, onReadFailed, readTerminals, stop };
};

const tick = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(2_000);
};

describe('trackTypedScriptRun', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records the exit of the typed command once the terminal is back at its prompt', async () => {
    const { record } = setup({
      reads: [
        [terminalOf({ foregroundPid: 200 })],
        [terminalOf({ lastExitCode: 0, lastExitCommand: 'pnpm run db:migrate' })],
      ],
    });
    await tick();
    expect(record).not.toHaveBeenCalled();
    await tick();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        scriptId: 'script-db-migrate',
        name: 'db:migrate',
        mountId,
        exitCode: 0,
      }),
    );
  });

  it('records a failing exit too, so a failed migration never settles the move', async () => {
    const { record } = setup({
      reads: [[terminalOf({ lastExitCode: 1, lastExitCommand: 'pnpm run db:migrate' })]],
    });
    await tick();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ exitCode: 1 }));
  });

  it('ignores another command the user typed in that terminal', async () => {
    const { record } = setup({
      reads: [[terminalOf({ lastExitCode: 0, lastExitCommand: 'ls' })]],
    });
    await tick();
    await tick();
    expect(record).not.toHaveBeenCalled();
  });

  it('stops following when the terminal was closed', async () => {
    const { record, readTerminals } = setup({ reads: [[terminalOf()], []] });
    await tick();
    await tick();
    const reads = readTerminals.mock.calls.length;
    await tick();
    expect(readTerminals.mock.calls.length).toBe(reads);
    expect(record).not.toHaveBeenCalled();
  });

  it('reports once and stops after three failed reads', async () => {
    const { onReadFailed, readTerminals } = setup({ reads: [new Error('terminal list failed')] });
    await tick();
    await tick();
    await tick();
    await tick();
    expect(onReadFailed).toHaveBeenCalledTimes(1);
    expect(readTerminals).toHaveBeenCalledTimes(3);
  });

  it('records once even when the exit stays visible on later reads', async () => {
    const { record } = setup({
      reads: [[terminalOf({ lastExitCode: 0, lastExitCommand: 'pnpm run db:migrate' })]],
    });
    await tick();
    await tick();
    await tick();
    expect(record).toHaveBeenCalledTimes(1);
  });
});
