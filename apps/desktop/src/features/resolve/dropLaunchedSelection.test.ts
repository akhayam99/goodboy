// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { dropLaunchedSelection } from './dropLaunchedSelection';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });

type StateParams = {
  readonly selection: ReadonlyArray<string>;
};

const stateOf = ({ selection }: StateParams) => {
  const setReviewSelection = vi.fn();
  const state = {
    reviewSelection: { [SESSION_ID]: selection },
    setReviewSelection,
  };
  return { state, setReviewSelection };
};

describe('dropLaunchedSelection', () => {
  it('takes the launched comments out of the selection and keeps the others', () => {
    const { state, setReviewSelection } = stateOf({ selection: ['a', 'b', 'c'] });

    dropLaunchedSelection({ state, sessionId: SESSION_ID, threadIds: ['a', 'b'] });

    expect(setReviewSelection).toHaveBeenCalledWith({ sessionId: SESSION_ID, threadIds: ['c'] });
  });

  it('does not write when nothing launched was selected', () => {
    const { state, setReviewSelection } = stateOf({ selection: ['c'] });

    dropLaunchedSelection({ state, sessionId: SESSION_ID, threadIds: ['a'] });

    expect(setReviewSelection).not.toHaveBeenCalled();
  });
});
