// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import { useAppStore } from '../../store';
import { selectGroupBy } from './selectGroupBy';

const SESSION = nextSessionId();
const OTHER = nextSessionId();

afterEach(() => {
  useAppStore.setState({ groupBySession: {} });
});

const choiceOf = (params: { readonly branchCount: number; readonly sessionId?: typeof SESSION }) =>
  selectGroupBy({
    state: useAppStore.getState(),
    sessionId: params.sessionId ?? SESSION,
    branchCount: params.branchCount,
  });

describe('session grouping', () => {
  it('starts on By branch with two or more branches and on By state with fewer', () => {
    expect(choiceOf({ branchCount: 2 })).toBe('branch');
    expect(choiceOf({ branchCount: 1 })).toBe('state');
    expect(choiceOf({ branchCount: 0 })).toBe('state');
  });

  it('remembers the choice for one session only', () => {
    useAppStore.getState().setGroupBy({ sessionId: SESSION, groupBy: 'state' });

    expect(choiceOf({ branchCount: 3 })).toBe('state');
    expect(choiceOf({ branchCount: 3, sessionId: OTHER })).toBe('branch');
  });

  it('ignores the stored choice while the session has one branch', () => {
    useAppStore.getState().setGroupBy({ sessionId: SESSION, groupBy: 'branch' });

    expect(choiceOf({ branchCount: 1 })).toBe('state');
  });

  it('keeps the same state object when the choice does not change', () => {
    useAppStore.getState().setGroupBy({ sessionId: SESSION, groupBy: 'state' });
    const before = useAppStore.getState().groupBySession;
    useAppStore.getState().setGroupBy({ sessionId: SESSION, groupBy: 'state' });

    expect(useAppStore.getState().groupBySession).toBe(before);
  });
});
