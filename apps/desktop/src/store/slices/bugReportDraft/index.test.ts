import { beforeEach, describe, expect, it } from 'vitest';

import { createBugReportDraftSlice } from './index';
import { initialBugReportDraftState, type BugReportDraftState, type BugReportImage } from './state';

const image = (id: string): BugReportImage => ({
  id,
  fileName: `${id}.png`,
  mimeType: 'image/png',
  sizeBytes: 1024,
  dataUrl: `data:image/png;base64,${id}`,
});

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
    expect(harnessed.getState().bugReportDraft).toEqual({
      issueType: 'bug',
      title: '',
      description: '',
      images: [],
    });
  });

  it('keeps the type when only the description is written', () => {
    harnessed.slice.setBugReportDraft({ issueType: 'idea' });
    harnessed.slice.setBugReportDraft({ description: 'The board keeps the old goal' });

    expect(harnessed.getState().bugReportDraft).toEqual({
      issueType: 'idea',
      title: '',
      description: 'The board keeps the old goal',
      images: [],
    });
  });

  it('treats an emptied description as written, not as absent', () => {
    harnessed.slice.setBugReportDraft({ description: 'typed then deleted' });
    harnessed.slice.setBugReportDraft({ description: '' });

    expect(harnessed.getState().bugReportDraft.description).toBe('');
  });

  it('keeps the images while the description is rewritten', () => {
    harnessed.slice.addBugReportImages({ images: [image('shot-1')] });
    harnessed.slice.setBugReportDraft({ description: 'see the screenshot' });

    expect(harnessed.getState().bugReportDraft.images.map((i) => i.id)).toEqual(['shot-1']);
  });

  it('stops adding images once the cap is reached', () => {
    harnessed.slice.addBugReportImages({
      images: [image('a'), image('b'), image('c'), image('d'), image('e')],
    });

    expect(harnessed.getState().bugReportDraft.images.map((i) => i.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('removes one image and leaves the rest alone', () => {
    harnessed.slice.addBugReportImages({ images: [image('a'), image('b')] });
    harnessed.slice.removeBugReportImage({ imageId: 'a' });

    expect(harnessed.getState().bugReportDraft.images.map((i) => i.id)).toEqual(['b']);
  });

  it('drops both fields back to the start on a reset', () => {
    harnessed.slice.setBugReportDraft({ issueType: 'question', description: 'Where do plans go' });
    harnessed.slice.clearBugReportDraft();

    expect(harnessed.getState().bugReportDraft).toEqual(initialBugReportDraftState.bugReportDraft);
  });
});
