// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import type { ArtifactId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { setActiveLens, setFocusedArtifactId } from '../session-view/workSurface';
import { createDrawerSlice } from './index';
import { selectOpenDrawer } from './selectOpenDrawer';
import type { DrawerRequest } from './state';

const SESSION_ID = 'session-1' as SessionId;
const OTHER_SESSION_ID = 'session-2' as SessionId;

const GOAL_HISTORY: DrawerRequest = {
  kind: 'slot-history',
  sessionId: SESSION_ID,
  payload: { slotKey: 'goal' },
};

const README_PREVIEW: DrawerRequest = {
  kind: 'explore-file',
  sessionId: SESSION_ID,
  payload: {
    sessionDir: '/work/ledger-core',
    entry: {
      name: 'README.md',
      relPath: 'README.md',
      isDir: false,
      sizeBytes: 120,
      modifiedAt: null,
    },
  },
};

type Harness = {
  readonly get: () => AppState;
  readonly set: (patch: Partial<AppState>) => void;
  readonly slice: ReturnType<typeof createDrawerSlice>;
  readonly setLens: ReturnType<typeof setActiveLens>;
  readonly focusArtifact: ReturnType<typeof setFocusedArtifactId>;
};

const harness = (): Harness => {
  let state = {
    drawer: null,
    currentSessionId: SESSION_ID,
    activeLens: { [SESSION_ID]: 'explore' },
    lensHistory: {},
    selectedAgentId: {},
    sessionStudio: {},
    focusedWorkflowRunId: {},
    diffFocus: {},
    diffMountPath: {},
    terminalMountPath: {},
    focusedArtifactId: {},
    focusedGithubIssueNumber: {},
    focusedExternalTask: {},
  } as unknown as AppState;
  const set = (patch: Partial<AppState> | ((current: AppState) => Partial<AppState>)) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  const get = () => state;
  const slice = createDrawerSlice(set as never, get as never);
  state = { ...state, ...slice };
  return {
    get,
    set,
    slice,
    setLens: setActiveLens(set as never),
    focusArtifact: setFocusedArtifactId(set as never),
  };
};

describe('drawer slice', () => {
  let h = harness();

  beforeEach(() => {
    localStorage.clear();
    h = harness();
  });

  it('opens one drawer at a time', () => {
    h.slice.openDrawer(GOAL_HISTORY);
    h.slice.openDrawer(README_PREVIEW);

    expect(selectOpenDrawer(h.get())).toEqual(README_PREVIEW);
  });

  it('closes when its trigger is pressed again and switches when another one is', () => {
    h.slice.toggleDrawer(README_PREVIEW);
    expect(selectOpenDrawer(h.get())?.kind).toBe('explore-file');

    h.slice.toggleDrawer(GOAL_HISTORY);
    expect(selectOpenDrawer(h.get())?.kind).toBe('slot-history');

    h.slice.toggleDrawer(GOAL_HISTORY);
    expect(h.get().drawer).toBeNull();
  });

  it('keeps the drawer when another session changes lens', () => {
    h.slice.openDrawer(README_PREVIEW);

    h.setLens(OTHER_SESSION_ID, 'files');

    expect(selectOpenDrawer(h.get())).not.toBeNull();
  });

  it('shows nothing once the window moves to another session', () => {
    h.slice.openDrawer(README_PREVIEW);

    h.set({ currentSessionId: OTHER_SESSION_ID });

    expect(selectOpenDrawer(h.get())).toBeNull();
  });

  it('keeps the artifact drawer with its artifact and closes it when another one opens', () => {
    const report = 'artifact-report' as ArtifactId;
    h.focusArtifact(SESSION_ID, report);
    h.slice.openDrawer({
      kind: 'artifact',
      sessionId: SESSION_ID,
      payload: { artifactId: report, tab: 'details' },
    });
    h.slice.toggleDrawer({
      kind: 'artifact',
      sessionId: SESSION_ID,
      payload: { artifactId: report, tab: 'chat' },
    });
    expect(selectOpenDrawer(h.get())).toMatchObject({ payload: { tab: 'chat' } });
    h.focusArtifact(SESSION_ID, report);
    expect(h.get().drawer).not.toBeNull();
    h.focusArtifact(SESSION_ID, null);
    expect(h.get().drawer).toBeNull();
  });

  it('closes a plan part drawer when another artifact takes the focus', () => {
    const plan = 'plan-1' as ArtifactId;
    h.focusArtifact(SESSION_ID, plan);
    h.slice.openDrawer({
      kind: 'plan-part',
      sessionId: SESSION_ID,
      payload: { planId: plan, index: 1 },
    });
    h.focusArtifact(SESSION_ID, plan);
    expect(h.get().drawer).not.toBeNull();
    h.focusArtifact(SESSION_ID, 'artifact-report' as ArtifactId);
    expect(h.get().drawer).toBeNull();
  });

  it('closes on request', () => {
    h.slice.openDrawer(GOAL_HISTORY);
    h.slice.closeDrawer();

    expect(h.get().drawer).toBeNull();
  });
});
