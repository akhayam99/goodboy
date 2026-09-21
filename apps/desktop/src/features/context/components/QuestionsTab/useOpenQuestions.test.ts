import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentId, OpenQuestionId } from '@goodboy/types';
import { useOpenQuestions } from './useOpenQuestions';

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

  it('carries a delegated agent when the intent is set to one', () => {
    const { setAnswerIntent, setCustomAnswer } = useOpenQuestions.getState();
    setAnswerIntent(qid, { kind: 'agent', agentId: 'agent-1' as AgentId });
    setCustomAnswer(qid, 'drafted anyway');

    const draft = useOpenQuestions.getState().drafts[qid];
    expect(draft?.answerIntent).toEqual({ kind: 'agent', agentId: 'agent-1' });
    expect(draft?.customAnswer).toBe('drafted anyway');
  });

  it('keeps the answering intent across suggestion edits', () => {
    const { setAnswerIntent, toggleSuggestion } = useOpenQuestions.getState();
    setAnswerIntent(qid, { kind: 'agent', agentId: null });
    toggleSuggestion(qid, 'a');
    expect(useOpenQuestions.getState().drafts[qid]?.answerIntent).toEqual({
      kind: 'agent',
      agentId: null,
    });
  });
});
