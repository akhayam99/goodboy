import { create } from 'zustand';
import type {
  EffortLevel,
  OpenQuestion,
  OpenQuestionId,
  OpenQuestionSelectMode,
  ProviderId,
} from '@goodboy/types';

const UNDO_TTL_MS = 5_000;

export type DelegateRouting = {
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: EffortLevel;
};

export type AnswerIntent =
  | { readonly kind: 'person' }
  | { readonly kind: 'agent'; readonly hints: string; readonly routing: DelegateRouting };

export const PERSON_ANSWERS: AnswerIntent = { kind: 'person' };

export type QuestionDraft = {
  selectedSuggestions: ReadonlyArray<string>;
  customAnswer: string;
  showCustomField: boolean;
  answerIntent: AnswerIntent;
};

const isDelegatedDraft = (draft: QuestionDraft | undefined): boolean =>
  draft?.answerIntent.kind === 'agent';

type PendingUndo = {
  question: OpenQuestion;
  timer: ReturnType<typeof setTimeout>;
};

type OpenQuestionsUiState = {
  drafts: Record<string, QuestionDraft>;
  staged: ReadonlyArray<OpenQuestionId>;
  pendingUndo: PendingUndo | null;
  focusedQuestionId: OpenQuestionId | null;
  toggleSuggestion: (
    questionId: OpenQuestionId,
    suggestion: string,
    mode?: OpenQuestionSelectMode,
  ) => void;
  setCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  toggleCustomField: (questionId: OpenQuestionId, mode?: OpenQuestionSelectMode) => void;
  setAnswerIntent: (questionId: OpenQuestionId, intent: AnswerIntent) => void;
  clearDraft: (questionId: OpenQuestionId) => void;
  stageAnswer: (questionId: OpenQuestionId) => void;
  unstageAnswer: (questionId: OpenQuestionId) => void;
  flashAnswered: (ids: ReadonlyArray<OpenQuestionId>) => void;
  beginUndo: (question: OpenQuestion) => void;
  clearUndo: () => void;
  focusQuestion: (questionId: OpenQuestionId) => void;
  clearFocusedQuestion: () => void;
};

function emptyDraft(): QuestionDraft {
  return {
    selectedSuggestions: [],
    customAnswer: '',
    showCustomField: false,
    answerIntent: PERSON_ANSWERS,
  };
}

export const deriveDraftAnswer = (draft: QuestionDraft | undefined): string => {
  if (draft === undefined || isDelegatedDraft(draft)) {
    return '';
  }
  const custom = draft.showCustomField ? draft.customAnswer.trim() : '';
  const parts =
    custom.length > 0 ? [...draft.selectedSuggestions, custom] : draft.selectedSuggestions;
  return parts.join(', ');
};

export const isDraftReady = (draft: QuestionDraft | undefined): boolean =>
  isDelegatedDraft(draft) || deriveDraftAnswer(draft).length > 0;

export const useOpenQuestions = create<OpenQuestionsUiState>((set, get) => ({
  drafts: {},
  staged: [],
  pendingUndo: null,
  focusedQuestionId: null,

  toggleSuggestion: (questionId, suggestion, mode = 'one') => {
    const drafts = { ...get().drafts };
    const draft = drafts[questionId] ?? emptyDraft();
    const alreadySelected = draft.selectedSuggestions.includes(suggestion);
    if (mode === 'one') {
      drafts[questionId] = { ...draft, selectedSuggestions: [suggestion], showCustomField: false };
      set({ drafts });
      return;
    }
    const next = alreadySelected
      ? draft.selectedSuggestions.filter((s) => s !== suggestion)
      : [...draft.selectedSuggestions, suggestion];
    drafts[questionId] = { ...draft, selectedSuggestions: next };
    set({ drafts });
  },

  setCustomAnswer: (questionId, text) => {
    const drafts = { ...get().drafts };
    const draft = drafts[questionId] ?? emptyDraft();
    drafts[questionId] = { ...draft, customAnswer: text, showCustomField: true };
    set({ drafts });
  },

  toggleCustomField: (questionId, mode = 'many') => {
    const drafts = { ...get().drafts };
    const draft = drafts[questionId] ?? emptyDraft();
    if (mode === 'one') {
      drafts[questionId] = { ...draft, selectedSuggestions: [], showCustomField: true };
      set({ drafts });
      return;
    }
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
    set((s) => ({ drafts, staged: s.staged.filter((id) => id !== questionId) }));
  },

  stageAnswer: (questionId) => {
    set((s) => (s.staged.includes(questionId) ? {} : { staged: [...s.staged, questionId] }));
  },

  unstageAnswer: (questionId) => {
    set((s) => ({ staged: s.staged.filter((id) => id !== questionId) }));
  },

  flashAnswered: (ids) => {
    const drafts = { ...get().drafts };
    for (const id of ids) delete drafts[id];
    set((s) => ({
      drafts,
      staged: s.staged.filter((id) => !ids.includes(id)),
    }));
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

  focusQuestion: (questionId) => {
    set({ focusedQuestionId: questionId });
  },

  clearFocusedQuestion: () => {
    set({ focusedQuestionId: null });
  },
}));
