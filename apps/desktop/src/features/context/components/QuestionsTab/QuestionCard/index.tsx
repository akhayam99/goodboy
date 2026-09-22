import { useEffect, useId, useState } from 'react';
import { Check, MessageCircleQuestion, X } from 'lucide-react';
import { cn, Markdown, tintClasses, Tooltip } from '@goodboy/ui';
import type {
  OpenQuestion,
  OpenQuestionId,
  OpenQuestionSelectMode,
  ProviderId,
} from '@goodboy/types';
import { CONCEPT_TONE, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { TranscriptShell } from '../../../../chat/components/TranscriptShell';
import type { DelegateRowState } from '../../../questionDelegate';
import { SuggestionRow } from '../SuggestionRow';
import { CustomAnswerField } from '../CustomAnswerField';
import { DelegateAnswerRow } from '../DelegateAnswerRow';
import { DelegateAnswerPanel } from '../DelegateAnswerPanel';
import { DelegateWaitingRow } from '../DelegateWaitingRow';
import { deriveSuggestions } from '../deriveSuggestions';
import { orderSuggestions } from '../orderSuggestions';
import type { DelegateRouting } from '../useOpenQuestions';

const warningTint = tintClasses(CONCEPT_TONE.questions);

const BLOCKING_DESCRIPTION = 'This answer is required before the artifact or plan can be produced.';

type Props = {
  readonly question: OpenQuestion;
  readonly selectedSuggestions: ReadonlyArray<string>;
  readonly customAnswer: string;
  readonly showCustomField: boolean;
  readonly justAnswered: boolean;
  readonly askedByName?: string | null;
  readonly onToggleSuggestion: (
    questionId: OpenQuestionId,
    suggestion: string,
    mode: OpenQuestionSelectMode,
  ) => void;
  readonly onSetCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  readonly onToggleCustomField: (questionId: OpenQuestionId) => void;
  readonly onDismiss: (id: OpenQuestionId) => void;
  readonly onClearJustAnswered: (id: OpenQuestionId) => void;
  readonly delegateState: DelegateRowState;
  readonly delegateHints: string;
  readonly delegateRouting: DelegateRouting;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onChooseDelegate: () => void;
  readonly onCancelDelegate: () => void;
  readonly onDelegateHints: (hints: string) => void;
  readonly onDelegateRouting: (routing: DelegateRouting) => void;
  readonly onOpenDelegate?: (() => void) | null;
  readonly onTakeBackDelegate?: (() => void) | null;
};

export const QuestionCard = ({
  question,
  selectedSuggestions,
  customAnswer,
  showCustomField,
  justAnswered,
  askedByName = null,
  onToggleSuggestion,
  onSetCustomAnswer,
  onToggleCustomField,
  onDismiss,
  onClearJustAnswered,
  delegateState,
  delegateHints,
  delegateRouting,
  connectedProviders,
  onChooseDelegate,
  onCancelDelegate,
  onDelegateHints,
  onDelegateRouting,
  onOpenDelegate = null,
  onTakeBackDelegate = null,
}: Props) => {
  const [animate, setAnimate] = useState(false);
  const blockingId = useId();

  useEffect(() => {
    if (!justAnswered) {
      return;
    }
    setAnimate(true);
    const t = setTimeout(() => {
      setAnimate(false);
      onClearJustAnswered(question.id);
    }, 800);
    return () => clearTimeout(t);
  }, [justAnswered, question.id, onClearJustAnswered]);

  const baseSuggestions =
    question.suggestedAnswers.length > 0
      ? question.suggestedAnswers
      : deriveSuggestions(question.text);

  const recommended = question.recommendedAnswer?.trim() ?? '';
  const suggestions = orderSuggestions({
    suggestions: baseSuggestions,
    recommendedAnswer: recommended,
  });

  const mode: OpenQuestionSelectMode = question.selectMode ?? 'one';
  const groupRole = mode === 'many' ? 'group' : 'radiogroup';
  const groupLabel = mode === 'many' ? 'Pick one or more answers' : 'Pick one answer';
  const customFilled = customAnswer.trim().length > 0;
  const isDelegating = delegateState === 'chosen';
  const isWaiting = delegateState === 'running';
  const hasMeta =
    question.isBlocking || question.ownedByStepOrdinal != null || askedByName !== null;

  return (
    <TranscriptShell
      tone={CONCEPT_TONE.questions}
      variant="leftBorder"
      className="group flex flex-col gap-4 transition-[background-color,transform] duration-200 motion-safe:animate-fade-in"
    >
      <div
        data-testid="question-header"
        className="grid grid-cols-[minmax(0,1fr)_28px] items-start gap-2"
      >
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <MessageCircleQuestion
              size={ICON_SIZE.control}
              aria-hidden
              className={cn('shrink-0 translate-y-0.5', warningTint.icon)}
            />
            <Markdown
              text={question.text}
              className="min-w-0 gap-2 break-words text-sm font-medium leading-relaxed text-foreground"
            />
          </div>
          {hasMeta && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {question.isBlocking && (
                <span
                  className={cn('rounded-md px-1.5 py-0.5 text-2xs font-medium', warningTint.solid)}
                >
                  Blocking
                </span>
              )}
              {question.ownedByStepOrdinal != null && (
                <span className="text-3xs text-muted-foreground">
                  step {question.ownedByStepOrdinal}
                </span>
              )}
              {askedByName !== null && (
                <span className="min-w-0 truncate text-3xs text-muted-foreground">
                  asked by {askedByName}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          {!question.isBlocking && !isWaiting && (
            <Tooltip content="Dismiss question">
              <button
                type="button"
                onClick={() => onDismiss(question.id)}
                className={cn(
                  'shrink-0 rounded-md p-1 text-muted-foreground/60',
                  'transition-[color,background-color] duration-150',
                  'hover:bg-muted hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
                )}
                aria-label="Dismiss question"
              >
                {animate ? (
                  <Check size={ICON_SIZE.row} className={warningTint.icon} />
                ) : (
                  <X size={ICON_SIZE.row} />
                )}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div
        className="flex flex-col gap-2"
        aria-describedby={question.isBlocking ? blockingId : undefined}
      >
        {isDelegating && (
          <DelegateAnswerPanel
            hiddenOptionCount={suggestions.length + 1}
            hints={delegateHints}
            routing={delegateRouting}
            connectedProviders={connectedProviders}
            onHints={onDelegateHints}
            onRouting={onDelegateRouting}
            onCancel={onCancelDelegate}
          />
        )}
        {!isDelegating && !isWaiting && (
          <>
            {suggestions.length > 0 && (
              <div
                role={groupRole}
                aria-label={groupLabel}
                aria-describedby={question.isBlocking ? blockingId : undefined}
                className="flex flex-col gap-2"
              >
                {suggestions.map((suggestion) => (
                  <SuggestionRow
                    key={suggestion}
                    label={suggestion}
                    mode={mode}
                    selected={!customFilled && selectedSuggestions.includes(suggestion)}
                    recommended={recommended.length > 0 && suggestion === recommended}
                    onToggle={() => onToggleSuggestion(question.id, suggestion, mode)}
                  />
                ))}
              </div>
            )}
            <CustomAnswerField
              value={customAnswer}
              open={showCustomField}
              onToggle={() => onToggleCustomField(question.id)}
              onChange={(text) => onSetCustomAnswer(question.id, text)}
            />
          </>
        )}
        {isWaiting ? (
          <DelegateWaitingRow onOpen={onOpenDelegate} onTakeBack={onTakeBackDelegate} />
        ) : (
          <DelegateAnswerRow state={delegateState} onChoose={onChooseDelegate} />
        )}
        {question.isBlocking && (
          <span id={blockingId} className="sr-only">
            {BLOCKING_DESCRIPTION}
          </span>
        )}
      </div>
    </TranscriptShell>
  );
};
