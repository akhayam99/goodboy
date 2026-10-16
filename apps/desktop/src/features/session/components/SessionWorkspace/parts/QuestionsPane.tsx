import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { CircleCheck } from 'lucide-react';
import { EmptyLine, EmptyState, PageColumn, ScrollFade, Skeleton, PaneShell } from '@goodboy/ui';
import type { AgentId, OpenQuestion, OpenQuestionId, Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionAnsweredQuestions,
  useSessionOpenQuestions,
} from '../../../../../store';
import { LiveQuestionCard } from '../../../../context/components/QuestionsTab/LiveQuestionCard';
import { useOpenQuestions } from '../../../../context/components/QuestionsTab/useOpenQuestions';
import type { AgentKind } from '../../../agent-kind';
import { ContextLoadFailure } from '../../ContextDrawer/ContextLoadFailure';
import { selectOpenQuestions } from '../../SessionOverviewPane/lib';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { isTypingTarget } from '../../../../../shared/keyboard/isTypingTarget';
import { QuestionsQueue } from './QuestionsQueue';
import {
  buildQuestionsLens,
  nextWaitingQuestion,
  visibleQuestionRows,
  type QuestionRow,
} from './questionsLensModel';

type QuestionsPaneProps = {
  readonly session: Session;
};

const NO_KIND_OVERRIDES: Readonly<Record<AgentId, AgentKind>> = {};

export const QuestionsPane = ({ session }: QuestionsPaneProps) => {
  const sessionId = session.id as SessionId;
  const open = selectOpenQuestions(useSessionOpenQuestions(sessionId));
  const answered = useSessionAnsweredQuestions(sessionId);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const kindOverrides = useAppStore((s) => s.agentKindOverride ?? NO_KIND_OVERRIDES);
  const loadSessionOpenQuestions = useAppStore((s) => s.loadSessionOpenQuestions);
  const loadSessionAnsweredQuestions = useAppStore((s) => s.loadSessionAnsweredQuestions);
  const openLoaded = useAppStore((s) => s.sessionOpenQuestions[sessionId] !== undefined);
  const answeredLoaded = useAppStore((s) => s.sessionAnsweredQuestions[sessionId] !== undefined);
  const loadError = useAppStore((s) => s.sessionQuestionsLoadError[sessionId]);
  const dismissOpenQuestion = useAppStore((s) => s.dismissOpenQuestion);
  const restoreDismissedOpenQuestion = useAppStore((s) => s.restoreDismissedOpenQuestion);
  const staged = useOpenQuestions((s) => s.staged);
  const unstageAnswer = useOpenQuestions((s) => s.unstageAnswer);
  const pendingUndo = useOpenQuestions((s) => s.pendingUndo);
  const beginUndo = useOpenQuestions((s) => s.beginUndo);
  const clearUndo = useOpenQuestions((s) => s.clearUndo);
  const focusedQuestionId = useOpenQuestions((s) => s.focusedQuestionId);
  const clearFocusedQuestion = useOpenQuestions((s) => s.clearFocusedQuestion);
  const [selectedId, setSelectedId] = useState<OpenQuestionId | null>(null);

  const loadQuestions = useCallback(() => {
    void loadSessionOpenQuestions(sessionId);
    void loadSessionAnsweredQuestions(sessionId);
  }, [sessionId, loadSessionOpenQuestions, loadSessionAnsweredQuestions]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const dismissed = pendingUndo?.question.sessionId === sessionId ? pendingUndo.question : null;

  const model = useMemo(
    () => buildQuestionsLens({ open, answered, agents, staged, dismissed }),
    [open, answered, agents, staged, dismissed],
  );
  const allRows = useMemo(() => visibleQuestionRows({ model, isAnsweredOpen: true }), [model]);
  const rows = allRows;

  useEffect(() => {
    if (focusedQuestionId == null || !openLoaded) {
      return;
    }
    if (allRows.some((row) => row.question.id === focusedQuestionId)) {
      setSelectedId(focusedQuestionId);
    }
    clearFocusedQuestion();
  }, [allRows, clearFocusedQuestion, focusedQuestionId, openLoaded]);

  const selectedRow =
    allRows.find((row) => row.question.id === selectedId) ??
    model.waiting[0] ??
    model.delegated[0] ??
    null;
  const effectiveId = selectedRow?.question.id ?? null;

  const moveSelection = (step: number) => {
    if (rows.length === 0) {
      return;
    }
    const index = rows.findIndex((row) => row.question.id === effectiveId);
    const next = index === -1 ? 0 : Math.max(0, Math.min(rows.length - 1, index + step));
    setSelectedId(rows[next]?.question.id ?? null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (event.key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1);
      return;
    }
    if (event.key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1);
    }
  };

  const handleDismiss = useCallback(
    async (question: OpenQuestion) => {
      await dismissOpenQuestion(sessionId, question);
      beginUndo(question);
    },
    [beginUndo, dismissOpenQuestion, sessionId],
  );

  const handleUndoDismiss = useCallback(
    async (question: OpenQuestion) => {
      await restoreDismissedOpenQuestion(sessionId, question);
      clearUndo();
      setSelectedId(question.id);
    },
    [clearUndo, restoreDismissedOpenQuestion, sessionId],
  );

  const handleUndoRow = (row: QuestionRow) => {
    if (row.kind === 'staged') {
      unstageAnswer(row.question.id);
      setSelectedId(row.question.id);
      return;
    }
    void handleUndoDismiss(row.question);
  };

  const selectNextWaiting = (from: OpenQuestionId) => {
    setSelectedId(nextWaitingQuestion({ model, from }));
  };

  if ((!openLoaded || !answeredLoaded) && loadError !== undefined) {
    return (
      <PaneShell title="Questions">
        <ContextLoadFailure title="Questions" onRetry={loadQuestions} />
      </PaneShell>
    );
  }

  if (!openLoaded || !answeredLoaded) {
    return (
      <PaneShell title="Questions">
        <div className="flex flex-col gap-2" role="status" aria-label="Loading questions">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-border-soft p-3">
              <Skeleton className="h-3 w-40 rounded-sm" />
              <Skeleton className="h-3 w-3/4 rounded-sm" />
              <Skeleton className="h-3 w-1/2 rounded-sm" />
            </div>
          ))}
        </div>
      </PaneShell>
    );
  }

  if (allRows.length === 0) {
    return (
      <PaneShell title="Questions">
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.questions}
          title="No questions yet"
          description="Agents ask you here when they need a decision."
        />
      </PaneShell>
    );
  }

  const question = selectedRow?.question ?? null;
  return (
    <PaneShell title="Questions" scroll="self">
      <PageColumn className="flex min-h-0 flex-1 flex-col pb-5">
        <div
          onKeyDown={handleKeyDown}
          className="grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)] gap-x-6 @max-[56rem]:grid-cols-[15rem_minmax(0,1fr)]"
        >
          <div className="flex min-h-0 flex-col">
            <QuestionsQueue
              model={model}
              agents={agents}
              kindOverrides={kindOverrides}
              selectedId={effectiveId}
              onSelect={setSelectedId}
              onUndo={handleUndoRow}
            />
          </div>
          <ScrollFade className="min-h-0" fadeSize={24}>
            {question === null || selectedRow === null ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <CircleCheck size={ICON_SIZE.control} aria-hidden className="text-success" />
                <EmptyLine className="text-heading text-foreground">No questions</EmptyLine>
              </div>
            ) : (
              <div className="py-2">
                <LiveQuestionCard
                  key={question.id}
                  question={question}
                  sessionId={sessionId}
                  variant="full"
                  autoFocus
                  settled={
                    selectedRow.kind === 'answered' || selectedRow.kind === 'dismissed'
                      ? selectedRow.kind
                      : null
                  }
                  onAnswered={(answeredQuestion) => selectNextWaiting(answeredQuestion.id)}
                  onSkip={model.waiting.length > 1 ? () => selectNextWaiting(question.id) : null}
                  onDismiss={() => void handleDismiss(question)}
                  onUndoDismiss={() => void handleUndoDismiss(question)}
                />
              </div>
            )}
          </ScrollFade>
        </div>
      </PageColumn>
    </PaneShell>
  );
};
