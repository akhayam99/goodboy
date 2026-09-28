import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke, Channel } = vi.hoisted(() => ({
  invoke: vi.fn(),
  Channel: class {
    onmessage: (message: unknown) => void = () => undefined;
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke, Channel }));

import {
  applyHistoryPlan,
  isHistoryPredictionSupported,
  listHistoryBackups,
  predictHistoryPlan,
  pushWithLease,
  readHistoryGraph,
  readRemoteLease,
  runHistoryPlan,
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
        onto: null,
      },
    });
  });

  it('runs the plan on a copy with the branch and streams each step back', async () => {
    const seen: unknown[] = [];
    await runHistoryPlan({
      plan: { worktreePath: '/w', base: 'b', head: 'h', steps: [], onto: 'main-sha' },
      branch: 'hl/ledger-export',
      onProgress: (progress) => seen.push(progress),
    });
    const [command, payload] = invoke.mock.calls[0] ?? [];
    expect(command).toBe('history_plan_run');
    expect(payload.args).toEqual({
      plan: { worktreePath: '/w', base: 'b', head: 'h', steps: [], onto: 'main-sha' },
      branch: 'hl/ledger-export',
    });
    payload.onProgress.onmessage({ stage: 'step', index: 1, total: 2, sha: 'a' });
    expect(seen).toEqual([{ stage: 'step', index: 1, total: 2, sha: 'a' }]);
  });

  it('reads the lease against the head the plan started from', async () => {
    await readRemoteLease({
      worktreePath: '/w',
      branch: 'hl/ledger-export',
      expectedHead: 'head',
      incorporated: 'pushed-head',
      incorporatedSince: 'remote-at-apply',
      workspaceId: 'ws',
      projectId: 'p',
    });
    expect(invoke).toHaveBeenCalledWith('history_remote_lease', {
      worktreePath: '/w',
      branch: 'hl/ledger-export',
      expectedHead: 'head',
      incorporated: 'pushed-head',
      incorporatedSince: 'remote-at-apply',
      workspaceId: 'ws',
      projectId: 'p',
    });
  });

  it('reads the graph for the branch against its base', async () => {
    await readHistoryGraph({ worktreePath: '/w', baseBranch: 'main', branch: 'hl/ledger-export' });
    expect(invoke).toHaveBeenCalledWith('history_graph', {
      worktreePath: '/w',
      baseBranch: 'main',
      branch: 'hl/ledger-export',
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
