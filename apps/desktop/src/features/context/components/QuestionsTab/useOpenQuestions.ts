import { create } from 'zustand';
import {
  listOpenQuestionsForSession,
  markOpenQuestionAnswered,
  markOpenQuestionDismissed,
  restoreOpenQuestion,
} from '@goodboy/db';
import type { OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';

const UNDO_TTL_MS = 5_000;

interface QuestionDraft {
  selectedSuggestions: ReadonlyArray<string>;
  customAnswer: string;
  showCustomField: boolean;
}

interface PendingUndo {
  id: OpenQuestionId;
  question: OpenQuestion;
  timer: ReturnType<typeof setTimeout>;
}

interface OpenQuestionsState {
  questions: ReadonlyArray<OpenQuestion>;
  drafts: Record<string, QuestionDraft>;
  justAnswered: ReadonlyArray<OpenQuestionId>;
  pendingUndo: PendingUndo | null;

  loadQuestions: (sessionId: SessionId) => Promise<void>;
  toggleSuggestion: (questionId: OpenQuestionId, suggestion: string) => void;
  setCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  toggleCustomField: (questionId: OpenQuestionId) => void;
  dismissQuestion: (id: OpenQuestionId) => Promise<void>;
  undoDismiss: () => Promise<void>;
  submitAnsweredBatch: (
    sessionId: SessionId,
    onSubmit: (content: string) => Promise<void>,
  ) => Promise<void>;
  clearJustAnswered: (id: OpenQuestionId) => void;
}

function buildBatchPrompt(pairs: ReadonlyArray<{ question: string; answer: string }>): string {
  const lines = ['Answers to open questions:'];
  for (const { question, answer } of pairs) {
    lines.push(`\n- Q: ${question}`);
    lines.push(`  A: ${answer}`);
  }
  return lines.join('\n');
}

function emptyDraft(): QuestionDraft {
  return { selectedSuggestions: [], customAnswer: '', showCustomField: false };
}

export const useOpenQuestions = create<OpenQuestionsState>((set, get) => ({
  questions: [],
  drafts: {},
  justAnswered: [],
  pendingUndo: null,

  loadQuestions: async (sessionId) => {
    const questions = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'open');
    set({ questions });
  },

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

  dismissQuestion: async (id) => {
    const { pendingUndo, questions } = get();

    if (pendingUndo) {
      clearTimeout(pendingUndo.timer);
      await markOpenQuestionDismissed(tauriDatabase, pendingUndo.id);
    }

    const target = questions.find((q) => q.id === id);
    if (!target) return;

    set({ questions: questions.filter((q) => q.id !== id) });

    const timer = setTimeout(async () => {
      await markOpenQuestionDismissed(tauriDatabase, id);
      set((s) => ({
        pendingUndo: s.pendingUndo?.id === id ? null : s.pendingUndo,
      }));
    }, UNDO_TTL_MS);

    set({ pendingUndo: { id, question: target, timer } });
  },

  undoDismiss: async () => {
    const { pendingUndo } = get();
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timer);
    await restoreOpenQuestion(tauriDatabase, pendingUndo.id);
    set((s) => ({
      questions: [...s.questions, pendingUndo.question].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
      pendingUndo: null,
    }));
  },

  submitAnsweredBatch: async (sessionId, onSubmit) => {
    const { questions, drafts } = get();

    const pairs: Array<{ id: OpenQuestionId; question: string; answer: string }> = [];

    for (const q of questions) {
      const draft = drafts[q.id] ?? emptyDraft();
      const answer =
        draft.customAnswer.trim().length > 0
          ? draft.customAnswer.trim()
          : draft.selectedSuggestions.join(', ');
      if (answer.length === 0) continue;
      pairs.push({ id: q.id, question: q.text, answer });
    }

    if (pairs.length === 0) return;

    const content = buildBatchPrompt(pairs);
    await onSubmit(content);

    const now = new Date().toISOString();
    const answeredIds = pairs.map((p) => p.id);

    await Promise.all(pairs.map((p) => markOpenQuestionAnswered(tauriDatabase, p.id, p.answer)));

    // Reload open questions (answered ones are now gone)
    const remaining = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'open');

    const cleanedDrafts = { ...drafts };
    for (const id of answeredIds) {
      delete cleanedDrafts[id];
    }

    set({
      questions: remaining,
      drafts: cleanedDrafts,
      justAnswered: answeredIds,
    });

    void now; // used implicitly for animation timing
  },

  clearJustAnswered: (id) => {
    set((s) => ({ justAnswered: s.justAnswered.filter((x) => x !== id) }));
  },
}));
