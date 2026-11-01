import { Bot, RotateCcw } from 'lucide-react';
import { cn, ICON_SIZE, Tooltip, FOCUS_RING } from '@goodboy/ui';
import { PromptField } from '../../../../../shared/components/PromptField';
import type { ProviderId } from '@goodboy/types';

import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { QUESTION_DELEGATE_COPY, type DelegateRowState } from '../../../questionDelegate';
import type { DelegateRouting } from '../useOpenQuestions';

type Props = {
  readonly state: DelegateRowState;
  readonly hints: string;
  readonly routing: DelegateRouting;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly isDisabled?: boolean;
  readonly onChoose: () => void;
  readonly onCancel: () => void;
  readonly onHints: (hints: string) => void;
  readonly onRouting: (routing: DelegateRouting) => void;
};

const LINK_CLASS = cn(
  'inline-flex min-w-0 items-center gap-2 rounded-sm text-meta text-muted-foreground',
  'motion-safe:transition-colors enabled:hover:text-foreground disabled:text-faint-foreground',
  FOCUS_RING,
);

export const DelegateAnswerRow = ({
  state,
  hints,
  routing,
  connectedProviders,
  isDisabled = false,
  onChoose,
  onCancel,
  onHints,
  onRouting,
}: Props) => {
  if (state === 'running') {
    return null;
  }

  if (state === 'chosen') {
    return (
      <div data-testid="delegate-answer-row" data-state={state} className="flex flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-meta text-foreground">
          <Bot size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
          <span>{QUESTION_DELEGATE_COPY.chosen}</span>
          <RoutingPicker
            ariaLabel="Delegated agent routing"
            variant="pill"
            connectedProviders={connectedProviders}
            provider={routing.provider}
            model={routing.model}
            effort={{ editable: true, value: routing.effort }}
            disabled={false}
            onChange={onRouting}
          />
          <button type="button" onClick={onCancel} className={LINK_CLASS}>
            {QUESTION_DELEGATE_COPY.cancel}
          </button>
        </div>
        <PromptField
          kind="document"
          label="Hints for the delegated agent"
          value={hints}
          onChange={onHints}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder={QUESTION_DELEGATE_COPY.hintsPlaceholder}
          minRows={1}
          maxRows={4}
          textClassName="text-meta"
        />
      </div>
    );
  }

  const isBlocked = state === 'blocked';
  const link = (
    <button
      type="button"
      data-testid="delegate-answer-row"
      data-state={state}
      disabled={isBlocked || isDisabled}
      onClick={onChoose}
      className={LINK_CLASS}
    >
      {state === 'retry' ? (
        <RotateCcw size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      ) : (
        <Bot size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      )}
      <span className="min-w-0 break-words text-left">
        {state === 'retry' ? QUESTION_DELEGATE_COPY.retry : QUESTION_DELEGATE_COPY.offer}
      </span>
    </button>
  );

  if (!isBlocked) {
    return <div className="flex min-w-0 items-center">{link}</div>;
  }

  return (
    <div className="flex min-w-0 items-center">
      <Tooltip content={QUESTION_DELEGATE_COPY.blocked}>{link}</Tooltip>
    </div>
  );
};
