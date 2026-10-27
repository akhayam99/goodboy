// @vitest-environment node

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { AppStore } from '../../store';
import { START_HINT_SCOPES } from '../startHints/startHintScopes';
import { rebaseStopVerbs } from './rebaseStopVerbs';
import { aRebaseRun } from '../../../features/history/testing/aRebaseRun';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-ledger-core' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const spies = () => ({
  resolveRebaseWithAuto: vi.fn<AppStore['resolveRebaseWithAuto']>(async () => ({
    kind: 'nothing',
  })),
  resolveRebaseMyself: vi.fn<AppStore['resolveRebaseMyself']>(async () => null),
  keepRebaseStop: vi.fn<AppStore['keepRebaseStop']>(async () => undefined),
  bringOriginInAndPush: vi.fn<AppStore['bringOriginInAndPush']>(async () => 'pushed'),
  adoptRebaseStop: vi.fn<AppStore['adoptRebaseStop']>(() => null),
  restoreHistory: vi.fn<AppStore['restoreHistory']>(async () => 'restored'),
  rebaseBranch: vi.fn<AppStore['rebaseBranch']>(async () => 'rebased'),
  fixPushWithAgent: vi.fn<AppStore['fixPushWithAgent']>(async () => undefined),
  pushHistoryRewrite: vi.fn<AppStore['pushHistoryRewrite']>(async () => 'pushed'),
  loadHistoryDraft: vi.fn<AppStore['loadHistoryDraft']>(async () => undefined),
});

let actions: ReturnType<typeof spies>;

beforeEach(async () => {
  await resetStoryStore();
  actions = spies();
  store.setState(actions);
});

const verbs = () =>
  rebaseStopVerbs({ get: store.getState, sessionId: SESSION_ID, mountId: MOUNT_ID });

describe('rebaseStopVerbs, the one set of verbs of a stopped rebase', () => {
  it('hands every verb the session and the mount it was built for', async () => {
    const run = verbs();

    await run.resolveMyself();
    await run.keep();
    await run.bringIn();
    await run.retryRebase();

    const target = { sessionId: SESSION_ID, mountId: MOUNT_ID };
    expect(actions.resolveRebaseMyself).toHaveBeenCalledWith(target);
    expect(actions.keepRebaseStop).toHaveBeenCalledWith(target);
    expect(actions.bringOriginInAndPush).toHaveBeenCalledWith(target);
    expect(actions.rebaseBranch).toHaveBeenCalledWith(target);
  });

  it('starts Auto with the hint typed for this mount and settles it once Auto took it', async () => {
    store.getState().setStartHint({
      sessionId: SESSION_ID,
      scope: START_HINT_SCOPES.rebase({ mountId: MOUNT_ID }),
      text: ' keep the lease ',
    });
    actions.resolveRebaseWithAuto.mockImplementation(async (params) => {
      params.onAccepted?.({ agentId: brandId<AgentId>({ value: 'agent-auto' }) });
      return { kind: 'nothing' };
    });

    await verbs().resolveWithAuto();

    expect(actions.resolveRebaseWithAuto).toHaveBeenCalledWith(
      expect.objectContaining({ mountIds: [MOUNT_ID], hint: 'keep the lease' }),
    );
    expect(
      store.getState().startHints[SESSION_ID]?.[START_HINT_SCOPES.rebase({ mountId: MOUNT_ID })],
    ).toBeUndefined();
  });

  it('starts the push fix with the hint typed for the push fix, from any surface', async () => {
    store.getState().setStartHint({
      sessionId: SESSION_ID,
      scope: START_HINT_SCOPES.pushFix({ mountId: MOUNT_ID }),
      text: 'Do not touch the lockfile',
    });
    actions.fixPushWithAgent.mockImplementation(async (params) => {
      params.onAccepted?.();
    });

    await verbs().fixPush();

    expect(actions.adoptRebaseStop).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
    expect(actions.fixPushWithAgent).toHaveBeenCalledWith(
      expect.objectContaining({ hint: 'Do not touch the lockfile' }),
    );
    expect(
      store.getState().startHints[SESSION_ID]?.[START_HINT_SCOPES.pushFix({ mountId: MOUNT_ID })],
    ).toBeUndefined();
  });

  it('keeps the hint of a push fix that was not accepted', async () => {
    store.getState().setStartHint({
      sessionId: SESSION_ID,
      scope: START_HINT_SCOPES.pushFix({ mountId: MOUNT_ID }),
      text: 'Do not touch the lockfile',
    });

    await verbs().fixPush();

    expect(
      store.getState().startHints[SESSION_ID]?.[START_HINT_SCOPES.pushFix({ mountId: MOUNT_ID })]
        ?.text,
    ).toBe('Do not touch the lockfile');
  });

  it('undoes a rebase only when the stop holds a backup', async () => {
    await verbs().undoRebase();
    expect(actions.restoreHistory).not.toHaveBeenCalled();

    actions.adoptRebaseStop.mockReturnValue(
      aRebaseRun({ mountId: MOUNT_ID, backupRef: 'refs/goodboy/backup/ledger/1' }),
    );
    await verbs().undoRebase();

    expect(actions.restoreHistory).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      backupRef: 'refs/goodboy/backup/ledger/1',
      shouldPush: false,
    });
  });

  it('retries the push of the recorded run with its own lease, and does nothing without a run', async () => {
    await verbs().retryPush();
    expect(actions.pushHistoryRewrite).not.toHaveBeenCalled();

    store.setState({
      historyRuns: {
        [MOUNT_ID]: aRebaseRun({ mountId: MOUNT_ID, remoteSha: 'online-sha', planId: null }),
      },
    });
    await verbs().retryPush();

    expect(actions.pushHistoryRewrite).toHaveBeenCalledWith(
      expect.objectContaining({ mountId: MOUNT_ID, expectedRemoteSha: 'online-sha' }),
    );
    expect(actions.loadHistoryDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
  });
});
