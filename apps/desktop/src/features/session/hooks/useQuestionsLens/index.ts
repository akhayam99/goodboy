import { useCallback, useEffect, useMemo } from 'react';
import type { Agent, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';
import {
  useAppStore,
  useSessionAnsweredQuestions,
  useSessionOpenQuestions,
} from '../../../../store';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';
import { selectOpenQuestions } from '../../components/SessionOverviewPane/lib';
import {
  buildQuestionsLens,
  type QuestionsLensModel,
} from '../../components/SessionWorkspace/parts/questionsLensModel';

const NO_AGENTS: ReadonlyArray<Agent> = [];

type Params = {
  readonly sessionId: SessionId;
  readonly load: 'on-mount' | 'when-missing';
};

export type QuestionsLens = {
  readonly model: QuestionsLensModel;
  readonly agents: ReadonlyArray<Agent>;
  readonly isLoaded: boolean;
  readonly hasLoadError: boolean;
  readonly reload: () => void;
  readonly focusedQuestionId: OpenQuestionId | null;
  readonly clearFocusedQuestion: () => void;
  readonly beginUndo: (question: OpenQuestion) => void;
  readonly clearUndo: () => void;
};

export const useQuestionsLens = ({ sessionId, load }: Params): QuestionsLens => {
  const stored = useSessionOpenQuestions(sessionId);
  const answered = useSessionAnsweredQuestions(sessionId);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const isOpenLoaded = useAppStore((state) => state.sessionOpenQuestions[sessionId] !== undefined);
  const isAnsweredLoaded = useAppStore(
    (state) => state.sessionAnsweredQuestions[sessionId] !== undefined,
  );
  const hasLoadError = useAppStore(
    (state) => state.sessionQuestionsLoadError[sessionId] !== undefined,
  );
  const loadSessionOpenQuestions = useAppStore((state) => state.loadSessionOpenQuestions);
  const loadSessionAnsweredQuestions = useAppStore((state) => state.loadSessionAnsweredQuestions);
  const staged = useOpenQuestions((state) => state.staged);
  const pendingUndo = useOpenQuestions((state) => state.pendingUndo);
  const focusedQuestionId = useOpenQuestions((state) => state.focusedQuestionId);
  const clearFocusedQuestion = useOpenQuestions((state) => state.clearFocusedQuestion);
  const beginUndo = useOpenQuestions((state) => state.beginUndo);
  const clearUndo = useOpenQuestions((state) => state.clearUndo);
  const dismissed = pendingUndo?.question.sessionId === sessionId ? pendingUndo.question : null;
  const open = useMemo(() => selectOpenQuestions(stored), [stored]);
  const model = useMemo(
    () => buildQuestionsLens({ open, answered, agents, staged, dismissed }),
    [open, answered, agents, staged, dismissed],
  );

  const reload = useCallback(() => {
    void loadSessionOpenQuestions(sessionId);
    void loadSessionAnsweredQuestions(sessionId);
  }, [loadSessionAnsweredQuestions, loadSessionOpenQuestions, sessionId]);

  const isLoaded = isOpenLoaded && isAnsweredLoaded;
  const shouldLoad = load === 'on-mount' || !isLoaded;

  useEffect(() => {
    if (!shouldLoad) {
      return;
    }
    reload();
  }, [reload, shouldLoad]);

  return {
    model,
    agents,
    isLoaded,
    hasLoadError,
    reload,
    focusedQuestionId,
    clearFocusedQuestion,
    beginUndo,
    clearUndo,
  };
};
