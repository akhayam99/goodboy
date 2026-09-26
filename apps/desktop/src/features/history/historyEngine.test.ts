import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import {
  applyHistoryPlan,
  isHistoryPredictionSupported,
  listHistoryBackups,
  predictHistoryPlan,
  pushWithLease,
  restoreHistoryBackup,
  tryHistoryPlan,
} from './historyEngine';

describe('history engine bridge', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue(null);
  });

  it('sends the plan with explicit nulls for missing messages and targets', async () => {
    await predictHistoryPlan({
      worktreePath: '/ledger-core',
      base: 'base',
      head: 'head',
      steps: [
        { sha: 'a', verb: 'pick' },
        { sha: 'b', verb: 'fixup', target: 'a' },
      ],
    });

    expect(invoke).toHaveBeenCalledWith('history_plan_predict', {
      args: {
        worktreePath: '/ledger-core',
        base: 'base',
        head: 'head',
        steps: [
          { sha: 'a', verb: 'pick', message: null, target: null },
          { sha: 'b', verb: 'fixup', message: null, target: 'a' },
        ],
      },
    });
  });

  it('routes the trial, the move and the restore to their own commands', async () => {
    await tryHistoryPlan({ worktreePath: '/w', base: 'b', head: 'h', steps: [] });
    await applyHistoryPlan({ worktreePath: '/w', branch: 'fix', expectedHead: 'h', newHead: 'n' });
    await restoreHistoryBackup({
      worktreePath: '/w',
      branch: 'fix',
      expectedHead: 'n',
      backupRef: 'refs/goodboy/backup/fix/1',
    });
    await listHistoryBackups({ worktreePath: '/w', branch: 'fix' });

    expect(invoke.mock.calls.map(([command]) => command)).toEqual([
      'history_plan_try',
      'history_plan_apply',
      'history_restore',
      'history_backups_list',
    ]);
  });

  it('pushes with the lease on the remote sha read before the push', async () => {
    await pushWithLease({
      worktreePath: '/w',
      branch: 'fix',
      expectedRemoteSha: 'abc',
      workspaceId: 'ws',
      projectId: null,
    });

    expect(invoke).toHaveBeenCalledWith('git_push_with_lease', {
      cwd: '/w',
      branch: 'fix',
      expectedRemoteSha: 'abc',
      workspaceId: 'ws',
      projectId: null,
    });
  });

  it('treats a failed version probe as unsupported', async () => {
    invoke.mockRejectedValueOnce(new Error('no git'));

    await expect(isHistoryPredictionSupported()).resolves.toBe(false);
  });
});
