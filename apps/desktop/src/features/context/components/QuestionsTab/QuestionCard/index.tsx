import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { FileText } from 'lucide-react';
import { cn, Markdown } from '@goodboy/ui';
import type { OpenQuestion } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { AgentKind } from '../../../../session/agent-kind';
import type { QuestionDelegateControls } from '../../../hooks/useQuestionDelegateControls';
import { AnswerSubmitButton } from '../AnswerSubmitButton';
import type { AnswerInputMode } from '../AnswerSubmitButton/answerInputMode';
import { DelegateAnswerRow } from '../DelegateAnswerRow';
import { DelegateWaitingRow } from '../DelegateWaitingRow';
import { deriveSuggestions } from '../deriveSuggestions';
import { orderSuggestions } from '../orderSuggestions';
import { questionParts } from '../questionParts';
import { isDraftReady, type QuestionDraft } from '../useOpenQuestions';
import { QuestionAnswerDone } from './QuestionAnswerDone';
import { QuestionAnswerInput } from './QuestionAnswerInput';
import { QuestionCardTop } from './QuestionCardTop';
import type { QuestionPagerModel } from './QuestionPager';

export type QuestionCardState = 'open' | 'staged' | 'answered' | 'dismissed';

type Props = {
  readonly question: OpenQuestion;
  readonly variant: 'full' | 'compact';
  readonly state: QuestionCardState;
  readonly askerName: string | null;
  readonly askerKind: AgentKind | null;
  readonly age: string;
  readonly draft: QuestionDraft | undefined;
  readonly pager: QuestionPagerModel | null;
  readonly delegate: QuestionDelegateControls;
  readonly answeredByName?: string | null;
  readonly autoFocus?: boolean;
  readonly onToggleSuggestion: (suggestion: string) => void;
  readonly onToggleCustomField: () => void;
  readonly onSetCustomAnswer: (text: string) => void;
  readonly onAnswer: () => void;
  readonly onSkip: (() => void) | null;
  readonly onUndo: (() => void) | null;
  readonly onDismiss: (() => void) | null;
};

const BLOCKING_DESCRIPTION = 'This answer is required before the agent can go on.';
const RESOLVED_BY_AGENT = '[resolved by agent]';

type DoneParams = {
  readonly state: QuestionCardState;
  readonly question: OpenQuestion;
  readonly askerName: string | null;
  readonly answeredByName: string | null;
  readonly isHandedOff: boolean;
};

const doneLabel = ({
  state,
  question,
  askerName,
  answeredByName,
  isHandedOff,
}: DoneParams): string => {
  const asker = askerName ?? 'the agent';
  if (state === 'dismissed') {
    return 'Dismissed';
  }
  if (state === 'staged') {
    return isHandedOff
      ? `Handed to an agent · goes to ${asker} with the rest`
      : `Answered · goes to ${asker} with the rest`;
  }
  if (question.userAnswer === RESOLVED_BY_AGENT) {
    return 'Resolved by the agent';
  }
  if (question.answerSource === 'agent') {
    return answeredByName === null ? 'Answered by an agent' : `Answered by ${answeredByName}`;
  }
  return `Answered · sent to ${asker}`;
};

const inputModeOf = ({
  question,
  suggestions,
}: {
  readonly question: OpenQuestion;
  readonly suggestions: ReadonlyArray<string>;
}): AnswerInputMode => {
  if (suggestions.length === 0) {
    return 'text';
  }
  return question.selectMode === 'many' ? 'many' : 'one';
};

export const QuestionCard = ({
  question,
  variant,
  state,
  askerName,
  askerKind,
  age,
  draft,
  pager,
  delegate,
  answeredByName = null,
  autoFocus = false,
  onToggleSuggestion,
  onToggleCustomField,
  onSetCustomAnswer,
  onAnswer,
  onSkip,
  onUndo,
  onDismiss,
}: Props) => {
  const articleRef = useRef<HTMLElement>(null);
  const blockingId = useId();
  const isCompact = variant === 'compact';

  useEffect(() => {
    if (!autoFocus) {
      return;
    }
    articleRef.current?.focus({ preventScroll: true });
  }, [autoFocus, question.id]);

  const parts = questionParts({ text: question.text });
  const recommended = question.recommendedAnswer?.trim() ?? '';
  const suggestions = orderSuggestions({
    suggestions:
      question.suggestedAnswers.length > 0
        ? question.suggestedAnswers
        : deriveSuggestions(question.text),
    recommendedAnswer: recommended,
  });
  const inputMode = inputModeOf({ question, suggestions });
  const isOpen = state === 'open';
  const isWaiting = delegate.delegateState === 'running';
  const isHandedOff = delegate.delegateState === 'chosen';
  const canAnswer = isOpen && !isWaiting && (isHandedOff || isDraftReady(draft));
  const isLive = state === 'open' || state === 'staged';
  const answerText = question.userAnswer ?? '';
  const showsAnswerBox =
    state === 'answered' && answerText.length > 0 && answerText !== RESOLVED_BY_AGENT;

  const focusCard = () => articleRef.current?.focus({ preventScroll: true });

  const submit = () => {
    if (!canAnswer) {
      return;
    }
    onAnswer();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!isOpen || isWaiting || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      return;
    }
    if (/^[1-9]$/.test(event.key) && inputMode !== 'text' && !isHandedOff) {
      const index = Number(event.key) - 1;
      if (index < suggestions.length) {
        event.preventDefault();
        onToggleSuggestion(suggestions[index]!);
        return;
      }
      if (index === suggestions.length) {
        event.preventDefault();
        onToggleCustomField();
      }
      return;
    }
    if (event.key !== 'Enter') {
      return;
    }
    const role = target instanceof HTMLElement ? target.getAttribute('role') : null;
    const isOptionButton = role === 'radio' || role === 'checkbox';
    if (target instanceof HTMLButtonElement && !isOptionButton) {
      return;
    }
    event.preventDefault();
    submit();
  };

  return (
    <article
      ref={articleRef}
      tabIndex={-1}
      data-question-card={question.id}
      data-state={state}
      aria-label={parts.title}
      aria-describedby={question.isBlocking && isOpen ? blockingId : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        '@container flex min-w-0 flex-col outline-none motion-safe:animate-fade-in',
        isCompact ? 'gap-3 rounded-lg border border-border-soft bg-elevated p-4' : 'gap-5',
      )}
    >
      <QuestionCardTop
        askerName={askerName}
        askerKind={askerKind}
        isBlocking={question.isBlocking && isOpen}
        age={age}
        pager={pager}
        onDismiss={isOpen && !question.isBlocking && !isWaiting ? onDismiss : null}
      />
      <div className="flex min-w-0 flex-col gap-3">
        <div className={cn('flex min-w-0 flex-col', isCompact ? 'gap-1' : 'gap-1.5')}>
          <h3
            className={cn(
              'min-w-0 break-words text-foreground select-text',
              isCompact ? 'text-heading' : 'text-title',
            )}
          >
            {parts.title}
          </h3>
          {parts.context.length > 0 && (
            <Markdown
              text={parts.context}
              className={cn(
                'min-w-0 gap-2 break-words text-body text-muted-foreground select-text',
                isCompact && 'line-clamp-3',
              )}
            />
          )}
        </div>
        {!isCompact && parts.files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {parts.files.map((file) => (
              <span
                key={file}
                className="inline-flex items-center gap-1 rounded-sm border border-border-soft bg-fill px-1.5 text-code text-muted-foreground"
              >
                <FileText
                  size={ICON_SIZE.row}
                  aria-hidden
                  className="shrink-0 text-faint-foreground"
                />
                {file}
              </span>
            ))}
          </div>
        )}
      </div>
      {showsAnswerBox && (
        <p className="rounded-md bg-fill px-3 py-2 text-body text-foreground select-text">
          {answerText}
        </p>
      )}
      {isLive && isWaiting && (
        <DelegateWaitingRow
          onOpen={delegate.onOpenDelegate}
          onTakeBack={delegate.onTakeBackDelegate}
        />
      )}
      {isLive && !isWaiting && (
        <QuestionAnswerInput
          inputMode={inputMode}
          suggestions={suggestions}
          recommended={recommended}
          selectedSuggestions={draft?.selectedSuggestions ?? []}
          customAnswer={draft?.customAnswer ?? ''}
          showCustomField={draft?.showCustomField ?? false}
          askerName={askerName}
          isSettled={state === 'staged'}
          isHandedOff={isHandedOff}
          isCompact={isCompact}
          onToggleSuggestion={onToggleSuggestion}
          onToggleCustomField={onToggleCustomField}
          onSetCustomAnswer={onSetCustomAnswer}
          onSubmit={submit}
          onEscape={focusCard}
        />
      )}
      {isOpen && !isWaiting && (
        <>
          <DelegateAnswerRow
            state={delegate.delegateState}
            hints={delegate.delegateHints}
            routing={delegate.delegateRouting}
            connectedProviders={delegate.connectedProviders}
            onChoose={delegate.onChooseDelegate}
            onCancel={delegate.onCancelDelegate}
            onHints={delegate.onDelegateHints}
            onRouting={delegate.onDelegateRouting}
          />
          <AnswerSubmitButton
            inputMode={inputMode}
            optionCount={suggestions.length}
            canAnswer={canAnswer}
            isHandOff={isHandedOff}
            onAnswer={submit}
            onSkip={onSkip}
          />
        </>
      )}
      {!isOpen && (
        <QuestionAnswerDone
          label={doneLabel({ state, question, askerName, answeredByName, isHandedOff })}
          onUndo={onUndo}
        />
      )}
      {question.isBlocking && isOpen && (
        <span id={blockingId} className="sr-only">
          {BLOCKING_DESCRIPTION}
        </span>
      )}
    </article>
  );
};
