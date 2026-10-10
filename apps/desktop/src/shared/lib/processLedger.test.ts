import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));

import { invokeProcessLedgerList, type ProcessLedgerEntry } from './processLedger';

beforeEach(() => {
  vi.clearAllMocks();
});

const SCRIPT_ROW: ProcessLedgerEntry = {
  spawnId: '0f3a',
  kind: 'script',
  pid: 4242,
  pgid: 4242,
  sessionId: 'session-1',
  mountPath: null,
  cwd: '/work/ledger-core',
  startedAt: 1_700_000_000_000,
};

describe('invokeProcessLedgerList', () => {
  it('asks the shell for the ledger and returns its rows as sent', async () => {
    h.invoke.mockResolvedValueOnce([SCRIPT_ROW]);

    await expect(invokeProcessLedgerList()).resolves.toEqual([SCRIPT_ROW]);
    expect(h.invoke).toHaveBeenCalledWith('process_ledger_list');
  });

  it('returns an empty list when nothing is running', async () => {
    h.invoke.mockResolvedValueOnce([]);

    await expect(invokeProcessLedgerList()).resolves.toEqual([]);
  });
});
