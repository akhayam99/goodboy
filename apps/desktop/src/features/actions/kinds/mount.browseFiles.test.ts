// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import { mountFixture } from '../../../__tests__/helpers/actionFixtures';
import type { ActionEnv } from '../types';
import { MOUNT_KIND } from './mount';
import type { MountFacts } from './mountFacts';

const MOUNT = mountFixture({ worktreePath: '/work/harborline/ledger-core-rounding' });
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
  isRebasing: false,
  comments: 0,
  canStartTurnsHere: false,
  isScribeWriting: false,
  blockers: [],
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
    exploreMountPath: {},
    navigation: {},
    drawer: null,
  });
});

describe('mount.browseFiles', () => {
  it('opens Explore on that mount and never moves where agents write', async () => {
    const setSessionActiveMount = vi.fn(async () => undefined);
    useAppStore.setState({ setSessionActiveMount });

    await definition().run({ facts: facts(), env, choice: null });

    const state = useAppStore.getState();
    expect(state.activeLens[SESSION_ID]).toBe('explore');
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
