import { useCallback } from 'react';
import type { Agent, OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { classifyAgent } from '../../../session/agent-kind';
import { useAnswerQuestion } from '../../hooks/useAnswerQuestion';
import {
  canSendQuestionAsMessage,
  useSendQuestionAsMessage,
} from '../../hooks/useSendQuestionAsMessage';
import { useQuestionDelegateControls } from '../../hooks/useQuestionDelegateControls';
import { QuestionCard, type QuestionCardState } from './QuestionCard';
import type { QuestionPagerModel } from './QuestionCard/QuestionPager';
import { useOpenQuestions } from './useOpenQuestions';
import { useNow } from '../../../../shared/hooks/useNow';

type Props = {
  readonly question: OpenQuestion;
  readonly sessionId: SessionId;
  readonly variant: 'full' | 'compact';
  readonly pager?: QuestionPagerModel | null;
  readonly settled?: 'answered' | 'dismissed' | null;
  readonly autoFocus?: boolean;
  readonly onAnswered?: (question: OpenQuestion) => void;
  readonly onSkip?: (() => void) | null;
  readonly onDismiss?: (() => void) | null;
  readonly onUndoDismiss?: (() => void) | null;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const LiveQuestionCard = ({
  question,
  sessionId,
  variant,
  pager = null,
  settled = null,
  autoFocus = false,
  onAnswered,
  onSkip = null,
  onDismiss = null,
  onUndoDismiss = null,
}: Props) => {
  const now = useNow(30_000);
  const agents = useAppStore((state) => state.sessionPhaseRuns?.[sessionId] ?? NO_AGENTS);
  const kindOverride = useAppStore((state) =>
    question.createdByAgentId == null
      ? null
      : (state.agentKindOverride?.[question.createdByAgentId] ?? null),
  );
  const draft = useOpenQuestions((state) => state.drafts[question.id]);
  const isStaged = useOpenQuestions((state) => state.staged.includes(question.id));
  const toggleSuggestion = useOpenQuestions((state) => state.toggleSuggestion);
  const toggleCustomField = useOpenQuestions((state) => state.toggleCustomField);
  const setCustomAnswer = useOpenQuestions((state) => state.setCustomAnswer);
  const delegate = useQuestionDelegateControls({ sessionId, question });
  const { answer, undo } = useAnswerQuestion({ sessionId });
  const sendAsMessage = useSendQuestionAsMessage({ sessionId });

  const asker =
    question.createdByAgentId == null
      ? null
      : (agents.find((agent) => agent.id === question.createdByAgentId) ?? null);
  const answeredBy =
    question.answeredByAgentId == null
      ? null
      : (agents.find((agent) => agent.id === question.answeredByAgentId)?.name ?? null);
  const mode = question.selectMode ?? 'one';
  const state: QuestionCardState = settled ?? (isStaged ? 'staged' : 'open');
  const age = formatAge({
    from: state === 'answered' ? (question.answeredAt ?? question.createdAt) : question.createdAt,
    now,
  });

  const handleAnswer = useCallback(() => {
    void answer(question);
    onAnswered?.(question);
  }, [answer, onAnswered, question]);

  const handleSendAsMessage = useCallback(() => {
    void sendAsMessage(question).then((isSent) => {
      if (isSent) {
        onAnswered?.(question);
      }
    });
  }, [onAnswered, question, sendAsMessage]);

  const handleUndo = () => {
    if (state === 'staged') {
      undo(question.id);
      return;
    }
    onUndoDismiss?.();
  };

  return (
    <div data-oq-anchor={question.id} className="min-w-0">
      <QuestionCard
        question={question}
        variant={variant}
        state={state}
        askerName={asker?.name ?? null}
        askerKind={asker === null ? null : classifyAgent({ agent: asker, override: kindOverride })}
        age={age}
        draft={draft}
        pager={pager}
        delegate={delegate}
        answeredByName={answeredBy}
        autoFocus={autoFocus}
        onToggleSuggestion={(suggestion) => toggleSuggestion(question.id, suggestion, mode)}
        onToggleCustomField={() => toggleCustomField(question.id, mode)}
        onSetCustomAnswer={(text) => setCustomAnswer(question.id, text)}
        onAnswer={handleAnswer}
        onSkip={onSkip}
        onSendAsMessage={canSendQuestionAsMessage(question) ? handleSendAsMessage : null}
        onUndo={
          state === 'staged' || (state === 'dismissed' && onUndoDismiss !== null)
            ? handleUndo
            : null
        }
        onDismiss={onDismiss}
      />
    </div>
  );
};
