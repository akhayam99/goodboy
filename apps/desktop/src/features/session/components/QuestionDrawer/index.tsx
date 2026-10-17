import { useCallback, useMemo } from 'react';
import { DrawerFrame, EmptyLine, SkeletonText } from '@goodboy/ui';
import type { OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { LiveQuestionCard } from '../../../context/components/QuestionsTab/LiveQuestionCard';
import { questionParts } from '../../../context/components/QuestionsTab/questionParts';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';
import { useQuestionsLens } from '../../hooks/useQuestionsLens';
import { nextWaitingQuestion, questionRowsOf } from '../SessionWorkspace/parts/questionsLensModel';

type Props = {
  readonly sessionId: SessionId;
  readonly questionId: OpenQuestionId;
  readonly onClose: () => void;
};

const FALLBACK_TITLE = 'Question';

type NextParams = {
  readonly next: OpenQuestionId | null;
};

type QuestionParams = {
  readonly question: OpenQuestion;
};

export const QuestionDrawer = ({ sessionId, questionId, onClose }: Props) => {
  const { model, isLoaded } = useQuestionsLens({ sessionId, load: 'when-missing' });
  const openDrawer = useAppStore((state) => state.openDrawer);
  const dismissOpenQuestion = useAppStore((state) => state.dismissOpenQuestion);
  const restoreDismissedOpenQuestion = useAppStore((state) => state.restoreDismissedOpenQuestion);
  const beginUndo = useOpenQuestions((state) => state.beginUndo);
  const clearUndo = useOpenQuestions((state) => state.clearUndo);
  const row = useMemo(
    () => questionRowsOf({ model }).find((candidate) => candidate.question.id === questionId),
    [model, questionId],
  );

  const openQuestion = useCallback(
    ({ next }: NextParams) => {
      if (next === null) {
        return;
      }
      openDrawer({ kind: 'question', sessionId, payload: { questionId: next } });
    },
    [openDrawer, sessionId],
  );

  const dismiss = async ({ question }: QuestionParams) => {
    await dismissOpenQuestion(sessionId, question);
    beginUndo(question);
  };

  const undoDismiss = async ({ question }: QuestionParams) => {
    await restoreDismissedOpenQuestion(sessionId, question);
    clearUndo();
  };

  const title =
    row === undefined ? FALLBACK_TITLE : questionParts({ text: row.question.text }).title;

  return (
    <DrawerFrame
      title={title}
      icon={CONCEPT_ICONS.questions}
      iconClassName="text-muted-foreground"
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
