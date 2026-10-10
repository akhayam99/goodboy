// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { HistoryBackup, MountId, ProjectId, SessionId } from '@goodboy/types';
import type { HistoryRun } from '../../../../../store/slices/history/types';

const SESSION_ID = 'session-ledger' as SessionId;
const MOUNT_ID = 'mount-ledger' as MountId;

const h = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock('../../../../../store', () => ({
  useAppStore: Object.assign(
    <T>(selector: (state: Record<string, unknown>) => T) => selector(h.state),
    { getState: () => h.state, subscribe: () => () => undefined },
  ),
}));

import { useHistoryRunFlow } from './index';

const IDENTITY = {
  worktreePath: '/w/payments',
  branch: 'hl/ledger-export',
  projectId: 'project-payments' as ProjectId,
};

const RUN: HistoryRun = {
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  origin: 'plan',
  phase: 'applied',
  planId: 'plan-1',
  agentId: null,
  copyPath: null,
  stop: null,
  result: null,
  backupRef: 'refs/goodboy/backups/hl/ledger-export/1',
  remoteSha: 'remote-sha',
  holder: null,
  progress: null,
  applied: null,
  identity: IDENTITY,
  movedHead: null,
  threadShas: [],
  commitCount: null,
  updatedAt: 1,
};

const BACKUP: HistoryBackup = {
  refName: 'refs/b/1',
  sha: 'sha-1',
  subject: 'Export the ledger',
  createdAt: 1,
  isLegacy: false,
};

const setup = ({ hasUpstream = true, mountId = MOUNT_ID as MountId | null } = {}) => {
  const actions = {
    reportError: vi.fn(async () => undefined),
    loadHistoryDraft: vi.fn(async () => undefined),
    discardHistoryDraft: vi.fn(async () => undefined),
    applyHistoryDraft: vi.fn(async () => 'applied'),
    applyRewrittenHistory: vi.fn(async () => 'applied'),
    rewriteDraftWithAgent: vi.fn(async () => undefined),
    pushHistoryRewrite: vi.fn(async () => 'pushed'),
    restoreHistory: vi.fn(async () => 'restored'),
    bringOriginIntoHistory: vi.fn(async () => 'applied'),
    dismissHistoryRun: vi.fn(),
  };
  h.state = { ...actions };
  const view = renderHook(() => useHistoryRunFlow({ sessionId: SESSION_ID, mountId, hasUpstream }));
  return { actions, view };
};

const flow = (view: ReturnType<typeof setup>['view']) => {
  if (view.result.current === null) {
    throw new Error('no flow');
  }
  return view.result.current;
};

afterEach(() => cleanup());

describe('useHistoryRunFlow', () => {
  it('has no handlers without a mount', () => {
    const { view } = setup({ mountId: null });
    expect(view.result.current).toBeNull();
  });

  it('restores a chosen backup and pushes only when the branch has an upstream', async () => {
    const online = setup({ hasUpstream: true });
    await act(async () => {
      flow(online.view).restoreBackup(BACKUP);
    });
    expect(online.actions.restoreHistory).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      backupRef: 'refs/b/1',
      shouldPush: true,
    });
    cleanup();
    const local = setup({ hasUpstream: false });
    await act(async () => {
      flow(local.view).restoreBackup({ ...BACKUP, refName: 'refs/b/2' });
    });
    expect(local.actions.restoreHistory).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      backupRef: 'refs/b/2',
      shouldPush: false,
    });
  });

  it('undoes an applied rewrite from its own backup and pushes only after a push', async () => {
    const pushed = setup({ hasUpstream: true });
    await act(async () => {
      flow(pushed.view).restoreApplied({ ...RUN, phase: 'pushed' });
    });
    expect(pushed.actions.restoreHistory).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      backupRef: RUN.backupRef,
      shouldPush: true,
    });
    cleanup();
    const local = setup({ hasUpstream: true });
    await act(async () => {
      flow(local.view).restoreApplied({ ...RUN, phase: 'applied' });
    });
    expect(local.actions.restoreHistory).toHaveBeenCalledWith(
      expect.objectContaining({ shouldPush: false }),
    );
  });

  it('never restores an applied rewrite that has no backup', async () => {
    const { actions, view } = setup();
    await act(async () => {
      flow(view).restoreApplied({ ...RUN, backupRef: null });
    });
    expect(actions.restoreHistory).not.toHaveBeenCalled();
  });

  it('pushes with the run guard values, then reloads the draft', async () => {
    const { actions, view } = setup();
    await act(async () => {
      flow(view).push(RUN);
    });
    expect(actions.pushHistoryRewrite).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      origin: 'plan',
      planId: 'plan-1',
      expectedRemoteSha: 'remote-sha',
      identity: IDENTITY,
    });
    expect(actions.loadHistoryDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
  });

  it('routes apply, discard, rewrite, bring origin, dismiss and refresh to their actions', async () => {
    const { actions, view } = setup();
    await act(async () => {
      flow(view).apply(true);
      flow(view).discard();
      flow(view).rewriteWithAgent();
      flow(view).bringOrigin();
    });
    flow(view).dismiss();
    flow(view).refresh();
    const ids = { sessionId: SESSION_ID, mountId: MOUNT_ID };
    expect(actions.applyHistoryDraft).toHaveBeenCalledWith({ ...ids, shouldPush: true });
    expect(actions.discardHistoryDraft).toHaveBeenCalledWith(ids);
    expect(actions.rewriteDraftWithAgent).toHaveBeenCalledWith(ids);
    expect(actions.bringOriginIntoHistory).toHaveBeenCalledWith(ids);
    expect(actions.dismissHistoryRun).toHaveBeenCalledWith(ids);
    expect(actions.loadHistoryDraft).toHaveBeenCalledWith(ids);
  });

  it('applies the agent rewrite with the push choice', async () => {
    const { actions, view } = setup();
    await act(async () => {
      flow(view).applyRewritten(false);
    });
    expect(actions.applyRewrittenHistory).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      shouldPush: false,
    });
  });

  it('runs one apply at a time and one restore at a time', async () => {
    const { actions, view } = setup();
    const gate = { release: (): void => undefined };
    actions.applyHistoryDraft.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          gate.release = () => resolve('applied');
        }),
    );
    await act(async () => {
      flow(view).apply(true);
      flow(view).applyRewritten(true);
    });
    expect(actions.applyHistoryDraft).toHaveBeenCalledTimes(1);
    expect(actions.applyRewrittenHistory).not.toHaveBeenCalled();
    await act(async () => {
      gate.release();
    });
    const release = { fn: (): void => undefined };
    actions.restoreHistory.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          release.fn = () => resolve('restored');
        }),
    );
    await act(async () => {
      flow(view).restoreBackup(BACKUP);
      flow(view).restoreApplied(RUN);
    });
    expect(actions.restoreHistory).toHaveBeenCalledTimes(1);
    await act(async () => {
      release.fn();
    });
  });
});
