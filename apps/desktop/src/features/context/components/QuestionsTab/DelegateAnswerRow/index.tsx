import { Bot, RotateCcw } from 'lucide-react';
import { cn, Tooltip } from '@goodboy/ui';
import { PromptField } from '../../../../../shared/components/PromptField';
import type { ProviderId } from '@goodboy/types';
import { clampEffortForModel, getDefaultTurnModel } from '@goodboy/core';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { QUESTION_DELEGATE_COPY, type DelegateRowState } from '../../../questionDelegate';
import type { DelegateRouting } from '../useOpenQuestions';

type Props = {
  readonly state: DelegateRowState;
  readonly hints: string;
  readonly routing: DelegateRouting;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onChoose: () => void;
  readonly onCancel: () => void;
  readonly onHints: (hints: string) => void;
  readonly onRouting: (routing: DelegateRouting) => void;
};

const LINK_CLASS = cn(
  'inline-flex min-w-0 items-center gap-2 rounded-sm text-label text-muted-foreground',
  'motion-safe:transition-colors enabled:hover:text-foreground disabled:text-faint-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
);

export const DelegateAnswerRow = ({
  state,
  hints,
  routing,
  connectedProviders,
  onChoose,
  onCancel,
  onHints,
  onRouting,
}: Props) => {
  if (state === 'running') {
    return null;
  }

  if (state === 'chosen') {
    const onProvider = (provider: ProviderId | '') => {
      if (provider === '') {
        onRouting({ ...routing, provider });
        return;
      }
      const model = getDefaultTurnModel({ id: provider });
      onRouting({
        provider,
        model,
        effort: clampEffortForModel({ model, effort: routing.effort, provider }) ?? routing.effort,
      });
    };

    return (
      <div data-testid="delegate-answer-row" data-state={state} className="flex flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-label text-foreground">
          <Bot size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
          <span>{QUESTION_DELEGATE_COPY.chosen}</span>
          <RoutingPicker
            ariaLabel="Delegated agent routing"
            variant="pill"
            connectedProviders={connectedProviders}
            provider={routing.provider}
            model={routing.model}
            effort={{
              editable: true,
              value: routing.effort,
              onChange: (effort) => onRouting({ ...routing, effort }),
            }}
            disabled={false}
            onProvider={onProvider}
            onModel={(model) =>
              onRouting({
                ...routing,
                model,
                effort:
                  clampEffortForModel({
                    model,
                    effort: routing.effort,
                    provider: routing.provider === '' ? null : routing.provider,
                  }) ?? routing.effort,
              })
            }
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
          textClassName="text-label"
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
      disabled={isBlocked}
      title={isBlocked ? QUESTION_DELEGATE_COPY.blocked : undefined}
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
