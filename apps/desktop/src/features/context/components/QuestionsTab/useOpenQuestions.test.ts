import { beforeEach, describe, expect, it } from 'vitest';
import type { OpenQuestionId } from '@goodboy/types';
import { useOpenQuestions } from './useOpenQuestions';

const qid = 'q1' as OpenQuestionId;

beforeEach(() => {
  useOpenQuestions.setState({ drafts: {}, justAnswered: [], pendingUndo: null });
});

describe('useOpenQuestions.toggleSuggestion', () => {
  it('single-choice replaces the previous selection', () => {
    const { toggleSuggestion } = useOpenQuestions.getState();
    toggleSuggestion(qid, 'a');
    expect(useOpenQuestions.getState().drafts[qid]?.selectedSuggestions).toEqual(['a']);
    toggleSuggestion(qid, 'b');
    expect(useOpenQuestions.getState().drafts[qid]?.selectedSuggestions).toEqual(['b']);
  });

  it('single-choice clears the selection when the same option is clicked twice', () => {
    const { toggleSuggestion } = useOpenQuestions.getState();
    toggleSuggestion(qid, 'a');
    toggleSuggestion(qid, 'a');
    expect(useOpenQuestions.getState().drafts[qid]?.selectedSuggestions).toEqual([]);
  });

  it('multi-choice accumulates selections in click order and toggles them off individually', () => {
    const { toggleSuggestion } = useOpenQuestions.getState();
    toggleSuggestion(qid, 'a', 'many');
    toggleSuggestion(qid, 'b', 'many');
    toggleSuggestion(qid, 'c', 'many');
    expect(useOpenQuestions.getState().drafts[qid]?.selectedSuggestions).toEqual(['a', 'b', 'c']);
    toggleSuggestion(qid, 'b', 'many');
    expect(useOpenQuestions.getState().drafts[qid]?.selectedSuggestions).toEqual(['a', 'c']);
  });
});
