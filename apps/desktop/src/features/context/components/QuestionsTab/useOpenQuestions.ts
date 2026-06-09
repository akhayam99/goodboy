import { create } from 'zustand';
import type { OpenQuestion, OpenQuestionId } from '@goodboy/types';

const UNDO_TTL_MS = 5_000;

type QuestionDraft = {
  selectedSuggestions: ReadonlyArray<string>;
  customAnswer: string;
  showCustomField: boolean;
};

type PendingUndo = {
  question: OpenQuestion;
  timer: ReturnType<typeof setTimeout>;
};

type OpenQuestionsUiState = {
  drafts: Record<string, QuestionDraft>;
  justAnswered: ReadonlyArray<OpenQuestionId>;
  pendingUndo: PendingUndo | null;
  toggleSuggestion: (questionId: OpenQuestionId, suggestion: string) => void;
  setCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  toggleCustomField: (questionId: OpenQuestionId) => void;
  flashAnswered: (ids: ReadonlyArray<OpenQuestionId>) => void;
  clearJustAnswered: (id: OpenQuestionId) => void;
  beginUndo: (question: OpenQuestion) => void;
  clearUndo: () => void;
};

function emptyDraft(): QuestionDraft {
  return { selectedSuggestions: [], customAnswer: '', showCustomField: false };
}

export const useOpenQuestions = create<OpenQuestionsUiState>((set, get) => ({
  drafts: {},
  justAnswered: [],
  pendingUndo: null,

  toggleSuggestion: (questionId, suggestion) => {
    const drafts = { ...get().drafts };
    const draft = drafts[questionId] ?? emptyDraft();
    const current = draft.selectedSuggestions;
    const next = current.includes(suggestion)
      ? current.filter((s) => s !== suggestion)
      : [...current, suggestion];
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
