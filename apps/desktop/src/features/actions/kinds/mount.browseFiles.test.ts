// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import { mountFixture } from '../../../__tests__/helpers/actionFixtures';
import type { ActionEnv } from '../types';
import { MOUNT_KIND } from './mount';
import type { MountFacts } from './mountFacts';

const DOOR = mountFixture();
const MOUNT = mountFixture({
  mountId: brandId<MountId>({ value: 'mount-ledger-core-rounding' }),
  worktreePath: '/work/harborline/ledger-core-rounding',
  branch: 'hl/rounding',
  parallelIndex: 1,
});
const SESSION_ID = MOUNT.sessionId;

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const facts = (overrides: Partial<MountFacts> = {}): MountFacts => ({
  sessionId: SESSION_ID,
  mountId: MOUNT.mountId,
  projectId: MOUNT.projectId,
  label: MOUNT.branch,
  branch: MOUNT.branch,
  baseBranch: 'main',
  mountBaseBranch: null,
  worktreePath: MOUNT.worktreePath,
  keptPath: MOUNT.worktreePath,
  isRepo: true,
  isClosed: false,
  isBranchGone: false,
  canRestoreBranch: false,
  pr: null,
  requestLabel: null,
  requestNumber: null,
  requestProvider: null,
  createProvider: null,
  ahead: 0,
  unpushed: 0,
  behind: 0,
  dirty: 0,
  isDiverged: false,
  onlyOnline: null,
  isRebasing: false,
  rebaseConflict: null,
  autoBlockedReason: null,
  comments: 0,
  canStartTurnsHere: false,
  isScribeWriting: false,
  blockers: [],
  pinnedRunIds: [],
  pinnedRunLabel: null,
  editors: [],
  ...overrides,
});

const definition = () => {
  const found = MOUNT_KIND.actions.find((action) => action.id === 'mount.browseFiles');
  if (found === undefined) {
    throw new Error('the Browse files action is missing');
  }
  return found;
};

beforeEach(() => {
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID })],
    currentSessionId: SESSION_ID,
    activeLens: { [SESSION_ID]: null },
    sessionActiveMount: {},
    sessionProjectMounts: { [SESSION_ID]: [DOOR, MOUNT] },
    exploreMountPath: {},
    diffMountPath: {},
    branchTab: {},
    navigation: {},
    drawer: null,
  });
});

describe('mount.browseFiles', () => {
  it('opens the Files tab of that branch, not the first one, and never moves where agents write', async () => {
    const setSessionActiveMount = vi.fn(async () => undefined);
    useAppStore.setState({ setSessionActiveMount });

    await definition().run({ facts: facts(), env, choice: null });

    const state = useAppStore.getState();
    expect(state.activeLens[SESSION_ID]).toBe('branch');
    expect(state.branchTab[SESSION_ID]).toBe('files');
    expect(state.diffMountPath[SESSION_ID]).toBe(MOUNT.worktreePath);
    expect(state.drawer).toBeNull();
    expect(state.exploreMountPath[SESSION_ID]).toBe(MOUNT.worktreePath);
    expect(state.sessionActiveMount).toEqual({});
    expect(setSessionActiveMount).not.toHaveBeenCalled();
  });

  it('is offered for an open worktree and not for a closed one', () => {
    expect(definition().when({ facts: facts(), viewing: null })).toBe(true);
    expect(definition().when({ facts: facts({ isClosed: true }), viewing: null })).toBe(false);
    expect(definition().when({ facts: facts({ worktreePath: null }), viewing: null })).toBe(false);
  });
});
