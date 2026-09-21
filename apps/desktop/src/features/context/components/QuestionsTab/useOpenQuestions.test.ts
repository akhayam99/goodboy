import { beforeEach, describe, expect, it } from 'vitest';
import type { OpenQuestionId } from '@goodboy/types';
import { deriveDraftAnswer, useOpenQuestions, type DelegateRouting } from './useOpenQuestions';

const routing: DelegateRouting = { provider: 'anthropic', model: 'sonnet-5', effort: 'medium' };

const qid = 'q1' as OpenQuestionId;
const other = 'q2' as OpenQuestionId;

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

describe('useOpenQuestions drafts as the staging area', () => {
  it('keeps a draft when the user leaves the question and comes back', () => {
    const { setCustomAnswer, toggleSuggestion } = useOpenQuestions.getState();
    setCustomAnswer(qid, 'half an answer');
    toggleSuggestion(other, 'b');

    const draft = useOpenQuestions.getState().drafts[qid];
    expect(draft?.customAnswer).toBe('half an answer');
    expect(useOpenQuestions.getState().drafts[other]?.selectedSuggestions).toEqual(['b']);
  });

  it('keeps every staged draft when another question is submitted', () => {
    const { setCustomAnswer, flashAnswered } = useOpenQuestions.getState();
    setCustomAnswer(qid, 'staged');
    setCustomAnswer(other, 'submitted');

    flashAnswered([other]);

    expect(useOpenQuestions.getState().drafts[qid]?.customAnswer).toBe('staged');
    expect(useOpenQuestions.getState().drafts[other]).toBeUndefined();
  });

  it('clears a draft only when clearing is asked for', () => {
    const { setCustomAnswer, clearDraft } = useOpenQuestions.getState();
    setCustomAnswer(qid, 'staged');

    clearDraft(qid);

    expect(useOpenQuestions.getState().drafts[qid]).toBeUndefined();
  });
});

describe('useOpenQuestions answering intent', () => {
  it('defaults to the person answering', () => {
    const { setCustomAnswer } = useOpenQuestions.getState();
    setCustomAnswer(qid, 'mine');
    expect(useOpenQuestions.getState().drafts[qid]?.answerIntent).toEqual({ kind: 'person' });
  });

  it('carries the hints and the routing when the intent is set to an agent', () => {
    const { setAnswerIntent, setCustomAnswer } = useOpenQuestions.getState();
    setAnswerIntent(qid, { kind: 'agent', hints: 'weigh the migration cost', routing });
    setCustomAnswer(qid, 'drafted anyway');

    const draft = useOpenQuestions.getState().drafts[qid];
    expect(draft?.answerIntent).toEqual({
      kind: 'agent',
      hints: 'weigh the migration cost',
      routing,
    });
    expect(draft?.customAnswer).toBe('drafted anyway');
  });

  it('keeps the answering intent across suggestion edits', () => {
    const { setAnswerIntent, toggleSuggestion } = useOpenQuestions.getState();
    setAnswerIntent(qid, { kind: 'agent', hints: '', routing });
    toggleSuggestion(qid, 'a');
    expect(useOpenQuestions.getState().drafts[qid]?.answerIntent).toEqual({
      kind: 'agent',
      hints: '',
      routing,
    });
  });

  it('withholds a typed answer once the question is handed to an agent', () => {
    const { setAnswerIntent, setCustomAnswer } = useOpenQuestions.getState();
    setCustomAnswer(qid, 'mine');
    setAnswerIntent(qid, { kind: 'agent', hints: '', routing });

    expect(deriveDraftAnswer(useOpenQuestions.getState().drafts[qid])).toBe('');
  });
});
