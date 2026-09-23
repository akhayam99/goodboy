import { ArrowRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { StagedFlowAction } from '../resolveStagedFlow';
import { ProgressPips } from './ProgressPips';

type Props = {
  readonly answerCount: number;
  readonly totalCount: number;
  readonly onClick: () => void;
  readonly action?: StagedFlowAction;
  readonly stepIndex?: number;
  readonly stepCount?: number;
  readonly canGoBack?: boolean;
  readonly onBack?: () => void;
  readonly recap?: string;
  readonly disabled?: boolean;
};

const readyLabel = ({
  answerCount,
  totalCount,
}: {
  readonly answerCount: number;
  readonly totalCount: number;
}): string => {
  if (totalCount <= 1) {
    return 'ready to send';
  }
  return `${answerCount} of ${totalCount} answered`;
};

export const AnswerSubmitButton = ({
  answerCount,
  totalCount,
  onClick,
  action = 'send',
  stepIndex = 0,
  stepCount = 1,
  canGoBack = false,
  onBack,
  recap = '',
  disabled = false,
}: Props) => {
  const showsStepper = stepCount > 1;

  return (
    <div className="flex items-start justify-between gap-4 pt-2">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {showsStepper && <ProgressPips index={stepIndex} total={stepCount} />}
          <span
            aria-live="polite"
            className="text-2xs font-medium tabular-nums text-muted-foreground"
          >
            {readyLabel({ answerCount, totalCount })}
          </span>
        </div>
        {recap.length > 0 && (
          <p className="min-w-0 truncate text-3xs text-muted-foreground">{recap}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showsStepper && (
          <button
            type="button"
            onClick={onBack}
            disabled={!canGoBack}
            className={cn(
              'inline-flex items-center rounded-md px-2 py-1 text-2xs font-medium text-muted-foreground',
              'transition-[color,background-color] duration-150',
              'hover:bg-muted hover:text-foreground',
              'disabled:pointer-events-none disabled:opacity-40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            )}
          >
            Back
          </button>
        )}
        {action === 'continue' ? (
          <button
            type="button"
            onClick={onClick}
            className={cn(
              'inline-flex shrink-0 items-center rounded-md border border-border px-2.5 py-1 text-2xs font-semibold text-foreground',
              'transition-[color,background-color,border-color] duration-150',
              'hover:bg-muted active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            )}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              'group inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-2xs font-semibold',
              'bg-primary text-primary-foreground shadow-inset-primary',
              'transition-[filter,transform,box-shadow] duration-150 motion-safe:will-change-transform',
              'hover:brightness-105 active:scale-[0.98]',
              'disabled:pointer-events-none disabled:opacity-40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            )}
          >
            <span>Send</span>
            <ArrowRight
              size={ICON_SIZE.row}
              aria-hidden
              className="motion-safe:transition-transform group-hover:translate-x-0.5"
            />
          </button>
        )}
      </div>
    </div>
  );
};
