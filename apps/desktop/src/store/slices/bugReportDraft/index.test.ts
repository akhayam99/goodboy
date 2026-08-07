import { beforeEach, describe, expect, it } from 'vitest';

import { createBugReportDraftSlice } from './index';
import { initialBugReportDraftState, type BugReportDraftState } from './state';

const harness = () => {
  let state: BugReportDraftState = { ...initialBugReportDraftState };
  const set = (
    p: Partial<BugReportDraftState> | ((s: BugReportDraftState) => Partial<BugReportDraftState>),
  ) => {
    state = { ...state, ...(typeof p === 'function' ? p(state) : p) };
  };
  const slice = createBugReportDraftSlice(set as never, (() => state) as never);
  return { slice, getState: () => state };
};

describe('bug report draft slice', () => {
  let harnessed = harness();

  beforeEach(() => {
    harnessed = harness();
  });

  it('starts on the bug type with nothing written', () => {
    expect(harnessed.getState().bugReportDraft).toEqual({ issueType: 'bug', description: '' });
  });

  it('keeps the type when only the description is written', () => {
    harnessed.slice.setBugReportDraft({ issueType: 'idea' });
    harnessed.slice.setBugReportDraft({ description: 'The board keeps the old goal' });

    expect(harnessed.getState().bugReportDraft).toEqual({
      issueType: 'idea',
      description: 'The board keeps the old goal',
    });
  });

  it('treats an emptied description as written, not as absent', () => {
    harnessed.slice.setBugReportDraft({ description: 'typed then deleted' });
    harnessed.slice.setBugReportDraft({ description: '' });

    expect(harnessed.getState().bugReportDraft.description).toBe('');
  });

  it('drops both fields back to the start on a reset', () => {
    harnessed.slice.setBugReportDraft({ issueType: 'question', description: 'Where do plans go' });
    harnessed.slice.clearBugReportDraft();

    expect(harnessed.getState().bugReportDraft).toEqual(initialBugReportDraftState.bugReportDraft);
  });
});
