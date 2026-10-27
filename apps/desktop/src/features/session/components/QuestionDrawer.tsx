import { useCallback, useMemo } from 'react';
import { DrawerFrame, EmptyLine, FOCUS_RING, SkeletonText, cn } from '@goodboy/ui';
import type { AgentId, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { LiveQuestionCard } from '../../context/components/QuestionsTab/LiveQuestionCard';
import { useQuestionsLens } from '../hooks/useQuestionsLens';
import { useNow } from '../../../shared/hooks/useNow';
import { AGENT_KIND_META, type AgentKind } from '../agent-kind';
import { openAsker } from '../openAsker';
import { questionMetaOf } from './SessionWorkspace/parts/questionMetaOf';
import { nextWaitingQuestion, questionRowsOf } from './SessionWorkspace/parts/questionsLensModel';

type Props = {
  readonly sessionId: SessionId;
  readonly questionId: OpenQuestionId;
  readonly from: 'ask' | null;
  readonly onClose: () => void;
};

const FALLBACK_TITLE = 'Question';

const NO_KIND_OVERRIDES: Readonly<Record<AgentId, AgentKind>> = {};

type NextParams = {
  readonly next: OpenQuestionId | null;
};

type QuestionParams = {
  readonly question: OpenQuestion;
};

export const QuestionDrawer = ({ sessionId, questionId, from, onClose }: Props) => {
  const { model, agents, isLoaded, beginUndo, clearUndo } = useQuestionsLens({
    sessionId,
    load: 'when-missing',
  });
  const openDrawer = useAppStore((state) => state.openDrawer);
  const kindOverrides = useAppStore((state) => state.agentKindOverride ?? NO_KIND_OVERRIDES);
  const now = useNow(30_000);
  const dismissOpenQuestion = useAppStore((state) => state.dismissOpenQuestion);
  const restoreDismissedOpenQuestion = useAppStore((state) => state.restoreDismissedOpenQuestion);
  const row = useMemo(
    () => questionRowsOf({ model }).find((candidate) => candidate.question.id === questionId),
    [model, questionId],
  );

  const openQuestion = useCallback(
    ({ next }: NextParams) => {
      if (next === null) {
        return;
      }
      openDrawer({
        kind: 'question',
        sessionId,
        payload: from === null ? { questionId: next } : { questionId: next, from },
      });
    },
    [from, openDrawer, sessionId],
  );

  const dismiss = async ({ question }: QuestionParams) => {
    await dismissOpenQuestion(sessionId, question);
    beginUndo(question);
  };

  const undoDismiss = async ({ question }: QuestionParams) => {
    await restoreDismissedOpenQuestion(sessionId, question);
    clearUndo();
  };

  const meta = row === undefined ? null : questionMetaOf({ row, agents, kindOverrides, now });
  const asker =
    meta === null || meta.askerKind === null
      ? FALLBACK_TITLE
      : AGENT_KIND_META[meta.askerKind].noun;
  const title = meta === null ? FALLBACK_TITLE : `${asker} · ${meta.age}`;
  const askerId = row?.question.createdByAgentId ?? null;
  const askerAgent =
    askerId === null
      ? null
      : (agents.find((agent) => agent.id === askerId && agent.deletedAt == null) ?? null);
  const openTheAsker = () => {
    if (askerAgent === null || row === undefined) {
      return;
    }
    openAsker({
      state: useAppStore.getState(),
      sessionId,
      asker: askerAgent,
      questionId: row.question.id,
    });
  };
  const titleContent =
    meta === null || askerAgent === null ? undefined : (
      <h2 className="min-w-0 truncate">
        <button
          type="button"
          onClick={openTheAsker}
          aria-label={`Open the agent: ${askerAgent.name}`}
          className={cn(
            'rounded-sm underline decoration-border-soft underline-offset-3 hover:decoration-foreground',
            FOCUS_RING,
          )}
        >
          {asker}
        </button>
        <span className="text-muted-foreground">{` · ${meta.age}`}</span>
      </h2>
    );

  return (
    <DrawerFrame
      title={title}
      {...(titleContent !== undefined && { titleContent })}
      icon={CONCEPT_ICONS.questions}
      iconClassName="text-muted-foreground"
      {...(from === 'ask' && {
        back: {
          label: 'Back to Ask',
          onBack: () => openDrawer({ kind: 'ask', sessionId, payload: null }),
        },
      })}
      onClose={onClose}
    >
      {row === undefined ? (
        isLoaded ? (
          <EmptyLine className="text-body text-muted-foreground">
            This question is no longer in this session.
          </EmptyLine>
        ) : (
          <SkeletonText lines={3} />
        )
      ) : (
        <LiveQuestionCard
          key={row.question.id}
          question={row.question}
          sessionId={sessionId}
          variant="full"
          autoFocus
          settled={row.kind === 'answered' || row.kind === 'dismissed' ? row.kind : null}
          onAnswered={(answered) =>
            openQuestion({ next: nextWaitingQuestion({ model, from: answered.id }) })
          }
          onSkip={
            model.waiting.length > 1
              ? () => openQuestion({ next: nextWaitingQuestion({ model, from: row.question.id }) })
              : null
          }
          onDismiss={() => void dismiss({ question: row.question })}
          onUndoDismiss={() => void undoDismiss({ question: row.question })}
        />
      )}
    </DrawerFrame>
  );
};
