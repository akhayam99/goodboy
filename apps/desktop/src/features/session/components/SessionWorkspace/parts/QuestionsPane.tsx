import { useCallback, useEffect, useMemo } from 'react';
import { EmptyState, PaneShell, Skeleton } from '@goodboy/ui';
import type { AgentId, OpenQuestionId, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectOpenDrawer } from '../../../../../store/slices/drawer/selectOpenDrawer';
import type { AgentKind } from '../../../agent-kind';
import { useQuestionsLens } from '../../../hooks/useQuestionsLens';
import { ContextLoadFailure } from '../../ContextDrawer/ContextLoadFailure';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { QuestionsGrid } from './QuestionsGrid';
import { questionGroupsOf, questionRowsOf } from './questionsLensModel';

type QuestionsPaneProps = {
  readonly session: Session;
};

const NO_KIND_OVERRIDES: Readonly<Record<AgentId, AgentKind>> = {};

const TITLE = 'Questions';

const SKELETON_ROWS = 3;

type OpenParams = {
  readonly questionId: OpenQuestionId;
  readonly from: 'ask' | null;
};

export const QuestionsPane = ({ session }: QuestionsPaneProps) => {
  const sessionId = session.id as SessionId;
  const { model, agents, isLoaded, hasLoadError, reload, focusedQuestionId, clearFocusedQuestion } =
    useQuestionsLens({
      sessionId,
      load: 'on-mount',
    });
  const kindOverrides = useAppStore((s) => s.agentKindOverride ?? NO_KIND_OVERRIDES);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const openedId = useAppStore((s) => {
    const drawer = selectOpenDrawer(s);
    return drawer?.kind === 'question' && drawer.sessionId === sessionId
      ? drawer.payload.questionId
      : null;
  });
  const isAskOpen = useAppStore((s) => {
    const drawer = selectOpenDrawer(s);
    if (drawer === null || drawer.sessionId !== sessionId) {
      return false;
    }
    return drawer.kind === 'ask' || (drawer.kind === 'question' && drawer.payload.from === 'ask');
  });
  const groups = useMemo(() => questionGroupsOf({ model }), [model]);
  const rows = useMemo(() => questionRowsOf({ model }), [model]);

  const openQuestion = useCallback(
    ({ questionId, from }: OpenParams) => {
      openDrawer({
        kind: 'question',
        sessionId,
        payload: from === null ? { questionId } : { questionId, from },
      });
    },
    [openDrawer, sessionId],
  );

  useEffect(() => {
    if (focusedQuestionId === null || !isLoaded) {
      return;
    }
    if (rows.some((row) => row.question.id === focusedQuestionId)) {
      openQuestion({ questionId: focusedQuestionId, from: isAskOpen ? 'ask' : null });
    }
    clearFocusedQuestion();
  }, [clearFocusedQuestion, focusedQuestionId, isAskOpen, isLoaded, openQuestion, rows]);

  if (!isLoaded && hasLoadError) {
    return (
      <PaneShell title={TITLE}>
        <ContextLoadFailure title={TITLE} onRetry={reload} />
      </PaneShell>
    );
  }

  if (!isLoaded) {
    return (
      <PaneShell title={TITLE}>
        <div role="status" aria-label="Loading questions" className="flex flex-col">
          {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
            <div key={index} className="flex h-8 items-center gap-3">
              <Skeleton className="h-3 w-1/2 rounded-sm" />
              <Skeleton className="h-3 w-1/6 rounded-sm" />
            </div>
          ))}
        </div>
      </PaneShell>
    );
  }

  if (rows.length === 0) {
    return (
      <PaneShell title={TITLE}>
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.questions}
          title="No questions yet"
          description="Agents ask you here when they need a decision."
        />
      </PaneShell>
    );
  }

  return (
    <PaneShell title={TITLE}>
      <QuestionsGrid
        groups={groups}
        agents={agents}
        kindOverrides={kindOverrides}
        selectedId={openedId}
        onOpen={({ questionId }) => openQuestion({ questionId, from: isAskOpen ? 'ask' : null })}
      />
    </PaneShell>
  );
};
