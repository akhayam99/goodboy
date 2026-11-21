// @vitest-environment happy-dom
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
import {
  brandId,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionProjectMount,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { branchPlace, sessionPlace } from './place';
import { EMPTY_FOCUS, type BranchTab, type Location } from './types';
import { withKnownMount } from './withKnownMount';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const S1 = brandId<SessionId>({ value: 'session-ledger-export' });
const LEDGER_ID = brandId<MountId>({ value: 'mount-ledger-core' });
const NOTIFY_ID = brandId<MountId>({ value: 'mount-notify-relay' });
const LEDGER = '/work/ledger-core';
const NOTIFY = '/work/notify-relay';
const MOVED = '/work/moved/ledger-core';

type MountParams = {
  readonly mountId: MountId;
  readonly path: string;
};

const mountOn = ({ mountId, path }: MountParams): SessionProjectMount => ({
  mountId,
  sessionId: S1,
  projectId: brandId<ProjectId>({ value: `project-${mountId}` }),
  mountName: mountId,
  worktreePath: path,
  lastWorktreePath: null,
  repoRoot: path,
  branch: `hl/${mountId}`,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

type MountsParams = {
  readonly ledgerPath: string;
};

const mountsAt = ({ ledgerPath }: MountsParams) => ({
  [S1]: [
    mountOn({ mountId: LEDGER_ID, path: ledgerPath }),
    mountOn({ mountId: NOTIFY_ID, path: NOTIFY }),
  ],
});

type SavedParams = {
  readonly place: Location['place'];
};

const saved = ({ place }: SavedParams): Location => ({
  workspaceId: WS,
  place,
  studio: null,
  focus: EMPTY_FOCUS,
});

type LedgerPlaceParams = {
  readonly tab: BranchTab;
};

const ledgerPlace = ({ tab }: LedgerPlaceParams): Location['place'] =>
  sessionPlace({
    sessionId: S1,
    lens: 'branch',
    target: {
      kind: 'branch',
      mountId: LEDGER_ID,
      mountPath: LEDGER,
      tab,
      threadId: null,
      focus: null,
    },
  });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    currentWorkspaceId: WS,
    sessions: [aSession({ id: S1, workspaceId: WS })],
    sessionProjectMounts: mountsAt({ ledgerPath: LEDGER }),
    sessionActiveMount: { [S1]: NOTIFY_ID },
  });
});

type TargetParams = {
  readonly location: Location;
};

const targetOf = ({ location }: TargetParams) =>
  location.place.at === 'session' ? location.place.view.target : null;

describe('a branch address names its mount by id', () => {
  it('resolves a moved folder by the mount id before the path', () => {
    useAppStore.setState({ sessionProjectMounts: mountsAt({ ledgerPath: MOVED }) });
    const location = saved({
      place: ledgerPlace({ tab: 'files' }),
    });

    const known = withKnownMount({ state: useAppStore.getState(), location });

    expect(targetOf({ location: known })).toMatchObject({ mountId: LEDGER_ID, mountPath: MOVED });
  });

  it('drops a path no mount has when the address carries no id', () => {
    useAppStore.setState({ sessionProjectMounts: mountsAt({ ledgerPath: MOVED }) });
    const location = saved({
      place: branchPlace({ sessionId: S1, mountPath: LEDGER, tab: 'files' }),
    });

    const known = withKnownMount({ state: useAppStore.getState(), location });

    expect(targetOf({ location: known })).toMatchObject({ mountPath: null, focus: null });
  });

  it('records the mount id of the branch page it leaves, and Back finds the moved folder', () => {
    useAppStore
      .getState()
      .navigate({ to: branchPlace({ sessionId: S1, mountPath: LEDGER, tab: 'commits' }) });
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    const stack = useAppStore.getState().navigation[WS];
    const left = stack?.entries[(stack?.index ?? 0) - 1];
    expect(left === undefined ? null : targetOf({ location: left })).toMatchObject({
      mountId: LEDGER_ID,
      mountPath: LEDGER,
    });
    useAppStore.setState({ sessionProjectMounts: mountsAt({ ledgerPath: MOVED }) });

    useAppStore.getState().back();

    expect(useAppStore.getState().diffMountPath[S1]).toBe(MOVED);
  });

  it('reopens a saved branch address on the moved folder after a reload', async () => {
    useAppStore.setState({ sessionProjectMounts: mountsAt({ ledgerPath: MOVED }) });
    const location: Location = JSON.parse(
      JSON.stringify(saved({ place: ledgerPlace({ tab: 'commits' }) })),
    );

    await useAppStore.getState().restoreLocation({ location });

    expect(useAppStore.getState().diffMountPath[S1]).toBe(MOVED);
  });
});
