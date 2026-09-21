import { Bot } from 'lucide-react';
import { Textarea, cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { getDefaultTurnModel } from '@goodboy/core';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { clampEffort } from '../../../../chat/utils/chat-constants';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { QUESTION_DELEGATE_COPY } from '../../../questionDelegate';
import type { DelegateRouting } from '../useOpenQuestions';

type Props = {
  readonly hiddenOptionCount: number;
  readonly hints: string;
  readonly routing: DelegateRouting;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onHints: (hints: string) => void;
  readonly onRouting: (routing: DelegateRouting) => void;
  readonly onCancel: () => void;
};

const hiddenLabel = ({ count }: { readonly count: number }): string => {
  if (count === 1) {
    return '1 option hidden';
  }
  return `${count} options hidden`;
};

export const DelegateAnswerPanel = ({
  hiddenOptionCount,
  hints,
  routing,
  connectedProviders,
  onHints,
  onRouting,
  onCancel,
}: Props) => {
  const onProvider = (provider: ProviderId | '') => {
    if (provider === '') {
      onRouting({ ...routing, provider });
      return;
    }
    const model = getDefaultTurnModel({ id: provider });
    onRouting({ provider, model, effort: clampEffort(model, routing.effort) });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="text-2xs text-muted-foreground" data-testid="delegate-hidden-options">
          {hiddenLabel({ count: hiddenOptionCount })}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium text-muted-foreground',
            'transition-colors duration-150 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
          )}
        >
          {QUESTION_DELEGATE_COPY.back}
        </button>
      </div>
      <div
        data-testid="delegate-answer-panel"
        className={cn(
          'flex w-full min-w-0 flex-col gap-3 rounded-md border px-2 py-2',
          'border-primary/40 bg-primary/10 motion-safe:animate-fade-in',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Bot size={ICON_SIZE.row} aria-hidden className="shrink-0 text-primary" />
          <span className="min-w-0 text-2xs font-medium text-primary">
            {QUESTION_DELEGATE_COPY.panelTitle}
          </span>
        </div>
        <p className="text-2xs text-muted-foreground">{QUESTION_DELEGATE_COPY.panelHint}</p>
        <div className="flex flex-col gap-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              {QUESTION_DELEGATE_COPY.hintsLabel}
            </span>
            <span className="text-2xs lowercase tracking-normal text-muted-foreground/60">
              optional
            </span>
          </span>
          <Textarea
            aria-label="Hints for the delegated agent"
            value={hints}
            onChange={(event) => onHints(event.target.value)}
            placeholder={QUESTION_DELEGATE_COPY.hintsPlaceholder}
            minRows={2}
            maxRows={6}
            autoGrow
            className="text-xs"
          />
        </div>
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
            onRouting({ ...routing, model, effort: clampEffort(model, routing.effort) })
          }
        />
      </div>
    </div>
  );
};
