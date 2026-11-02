// @vitest-environment node

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);

import { describe, expect, it, vi } from 'vitest';
import { stubStoryInvoke } from '../../store/storyHarness';
import { applyHistoryPlan } from './historyEngine';
import { HISTORY_REASON_COPY } from './historyReasonCopy';

const MOVE = {
  worktreePath: '/ledger-core',
  branch: 'feature/harborline',
  expectedHead: 'a1',
  newHead: 'b2',
  shouldStash: false,
};

describe('history reason codes', () => {
  it.each(Object.entries(HISTORY_REASON_COPY))(
    'turns the blocked code %s into its sentence',
    async (code, sentence) => {
      stubStoryInvoke({ history_plan_apply: () => ({ kind: 'blocked', reason: code }) });
      await expect(applyHistoryPlan(MOVE)).resolves.toEqual({ kind: 'blocked', reason: sentence });
    },
  );

  it('keeps a sentence Rust already wrote', async () => {
    const reason = 'This worktree is on main, not feature.';
    stubStoryInvoke({ history_plan_apply: () => ({ kind: 'blocked', reason }) });
    await expect(applyHistoryPlan(MOVE)).resolves.toEqual({ kind: 'blocked', reason });
  });

  it('turns a thrown reason code into its sentence', async () => {
    stubStoryInvoke({
      history_plan_apply: () => {
        throw { kind: 'reason', message: 'changed-unreadable' };
      },
    });
    await expect(applyHistoryPlan(MOVE)).rejects.toMatchObject({
      kind: 'reason',
      message: HISTORY_REASON_COPY['changed-unreadable'],
    });
  });

  it('leaves other errors as they are', async () => {
    stubStoryInvoke({
      history_plan_apply: () => {
        throw { kind: 'git', message: 'git failed: index.lock exists' };
      },
    });
    await expect(applyHistoryPlan(MOVE)).rejects.toMatchObject({
      kind: 'git',
      message: 'git failed: index.lock exists',
    });
  });
});
