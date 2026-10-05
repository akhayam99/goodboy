// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { branchPlace } from '../navigation/place';
import { createSessionViewSlice } from './index';

const SESSION_ID = 'session-1' as SessionId;

type SliceState = ReturnType<typeof createSessionViewSlice>;

const navigate = vi.fn((params: { readonly to: unknown }) => {
  void params;
});
const closeDrawer = vi.fn();

const buildSlice = (): { readonly actions: SliceState; readonly getState: () => SliceState } => {
  let state = {} as SliceState;
  const set = (updater: Partial<SliceState> | ((s: SliceState) => Partial<SliceState>)): void => {
    const patch = typeof updater === 'function' ? updater(state) : updater;
    state = { ...state, ...patch };
  };
  const get = (): SliceState => state;
  const actions = createSessionViewSlice({
    set: set as Parameters<typeof createSessionViewSlice>[0]['set'],
    get: get as Parameters<typeof createSessionViewSlice>[0]['get'],
  });
  state = {
    ...actions,
    selectedAgentId: {},
    sessionPhaseRuns: {},
    diffMountPath: {},
    diffPage: {},
    navigate,
    closeDrawer,
  } as unknown as SliceState;
  return { actions, getState: get };
};

beforeEach(() => {
  navigate.mockClear();
  closeDrawer.mockClear();
});

describe('opening the diff from the resolve queue', () => {
  it('pins the order and the scroll position, and points the diff at the candidate', () => {
    const { actions, getState } = buildSlice();

    actions.openResolveDiff({
      sessionId: SESSION_ID,
      sha: 'candidate-sha',
      path: 'src/parser.ts',
      order: ['t-retry', 't-parser', 't-client'],
      scrollTop: 240,
    });

    expect(getState().resolveQueueView[SESSION_ID]?.order).toEqual([
      't-retry',
      't-parser',
      't-client',
    ]);
    expect(getState().resolveQueueView[SESSION_ID]?.scrollTop).toBe(240);
    expect(navigate).toHaveBeenCalledWith({
      to: branchPlace({
        sessionId: SESSION_ID,
        tab: 'files',
        focus: { kind: 'commit', sha: 'candidate-sha', path: 'src/parser.ts' },
      }),
    });
  });

  it('keeps every other session out of it', () => {
    const { actions, getState } = buildSlice();

    actions.openResolveDiff({
      sessionId: SESSION_ID,
      sha: 'candidate-sha',
      path: null,
      order: ['t-parser'],
      scrollTop: 10,
    });

    expect(getState().resolveQueueView['session-2' as SessionId]).toBeUndefined();
  });
});
