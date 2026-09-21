import { create } from 'zustand';
import type { AgentId, OpenQuestion, OpenQuestionId, OpenQuestionSelectMode } from '@goodboy/types';

const UNDO_TTL_MS = 5_000;

export type AnswerIntent =
  { readonly kind: 'person' } | { readonly kind: 'agent'; readonly agentId: AgentId | null };

export const PERSON_ANSWERS: AnswerIntent = { kind: 'person' };

type QuestionDraft = {
  selectedSuggestions: ReadonlyArray<string>;
  customAnswer: string;
  showCustomField: boolean;
  answerIntent: AnswerIntent;
};

type PendingUndo = {
  question: OpenQuestion;
  timer: ReturnType<typeof setTimeout>;
};

type OpenQuestionsUiState = {
  drafts: Record<string, QuestionDraft>;
  justAnswered: ReadonlyArray<OpenQuestionId>;
  pendingUndo: PendingUndo | null;
  toggleSuggestion: (
    questionId: OpenQuestionId,
    suggestion: string,
    mode?: OpenQuestionSelectMode,
  ) => void;
  setCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  toggleCustomField: (questionId: OpenQuestionId) => void;
  setAnswerIntent: (questionId: OpenQuestionId, intent: AnswerIntent) => void;
  clearDraft: (questionId: OpenQuestionId) => void;
  flashAnswered: (ids: ReadonlyArray<OpenQuestionId>) => void;
  clearJustAnswered: (id: OpenQuestionId) => void;
  beginUndo: (question: OpenQuestion) => void;
  clearUndo: () => void;
};

function emptyDraft(): QuestionDraft {
  return {
    selectedSuggestions: [],
    customAnswer: '',
    showCustomField: false,
    answerIntent: PERSON_ANSWERS,
  };
}

export const deriveDraftAnswer = (draft: QuestionDraft | undefined): string =>
  (draft?.customAnswer.trim().length ?? 0) > 0
    ? draft!.customAnswer.trim()
    : (draft?.selectedSuggestions ?? []).join(', ');

export const useOpenQuestions = create<OpenQuestionsUiState>((set, get) => ({
  drafts: {},
  justAnswered: [],
  pendingUndo: null,

  toggleSuggestion: (questionId, suggestion, mode = 'one') => {
    const drafts = { ...get().drafts };
    const draft = drafts[questionId] ?? emptyDraft();
    const alreadySelected = draft.selectedSuggestions.includes(suggestion);
    const next =
      mode === 'many'
        ? alreadySelected
          ? draft.selectedSuggestions.filter((s) => s !== suggestion)
          : [...draft.selectedSuggestions, suggestion]
        : alreadySelected
          ? []
          : [suggestion];
    drafts[questionId] = { ...draft, selectedSuggestions: next };
    set({ drafts });
  },

  setCustomAnswer: (questionId, text) => {
    const drafts = { ...get().drafts };
    const draft = drafts[questionId] ?? emptyDraft();
    drafts[questionId] = { ...draft, customAnswer: text };
    set({ drafts });
  },

  toggleCustomField: (questionId) => {
    const drafts = { ...get().drafts };
    const draft = drafts[questionId] ?? emptyDraft();
    drafts[questionId] = { ...draft, showCustomField: !draft.showCustomField };
    set({ drafts });
  },

  setAnswerIntent: (questionId, intent) => {
    const drafts = { ...get().drafts };
    const draft = drafts[questionId] ?? emptyDraft();
    drafts[questionId] = { ...draft, answerIntent: intent };
    set({ drafts });
  },

  clearDraft: (questionId) => {
    const drafts = { ...get().drafts };
    delete drafts[questionId];
    set({ drafts });
  },

  flashAnswered: (ids) => {
    const drafts = { ...get().drafts };
    for (const id of ids) delete drafts[id];
    set({ drafts, justAnswered: ids });
  },

  clearJustAnswered: (id) => {
    set((s) => ({ justAnswered: s.justAnswered.filter((x) => x !== id) }));
  },

  beginUndo: (question) => {
    const existing = get().pendingUndo;
    if (existing) {
      clearTimeout(existing.timer);
    }
    const timer = setTimeout(() => {
      set((s) => ({
        pendingUndo: s.pendingUndo?.question.id === question.id ? null : s.pendingUndo,
      }));
    }, UNDO_TTL_MS);
    set({ pendingUndo: { question, timer } });
  },

  clearUndo: () => {
    const existing = get().pendingUndo;
    if (existing) {
      clearTimeout(existing.timer);
    }
    set({ pendingUndo: null });
  },
}));
