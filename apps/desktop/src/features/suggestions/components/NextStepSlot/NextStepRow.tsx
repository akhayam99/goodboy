import { useEffect, useState } from 'react';
import { Ellipsis } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  IconButton,
  ROW_INTERACTIVE,
  cn,
  tintClasses,
  useDropdown,
} from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SUGGESTION_ICONS } from '../../suggestionIcons';
import type { NextStepBand, SessionSuggestion } from '../../types';
import type { SuggestionActionChoice, SuggestionActions } from '../../useSuggestionActions';
import type { AgentKindRouting } from '../../../session/agent-kind';
import { NextStepRunsOn } from './NextStepRunsOn';

const BAND_TONE: Record<NextStepBand, 'warning' | 'info' | 'primary' | 'neutral'> = {
  0: 'warning',
  1: 'info',
  2: 'primary',
  3: 'neutral',
};

type Props = {
  readonly suggestion: SessionSuggestion;
  readonly actions: SuggestionActions;
  readonly compact: boolean;
  readonly isPending: boolean;
  readonly pendingChoiceIds?: ReadonlySet<string>;
  readonly onNotNow: () => void;
};

const NO_PENDING_CHOICES: ReadonlySet<string> = new Set();

const choiceText = ({
  choice,
  choices,
}: {
  readonly choice: SuggestionActionChoice;
  readonly choices: ReadonlyArray<SuggestionActionChoice>;
}) => {
  const isShared = choices.some((other) => other.id !== choice.id && other.label === choice.label);
  return isShared && choice.description !== '' ? choice.description : choice.label;
};

export const NextStepRow = ({
  suggestion,
  actions,
  compact,
  isPending,
  pendingChoiceIds = NO_PENDING_CHOICES,
  onNotNow,
}: Props) => {
  const Icon = SUGGESTION_ICONS[suggestion.kind];
  const tone = BAND_TONE[suggestion.band];
  const dropdown = useDropdown({ align: 'end', expectedWidth: 160, expectedHeight: 80 });
  const [isConfirming, setIsConfirming] = useState(false);
  const [routingOverride, setRoutingOverride] = useState<AgentKindRouting | null>(null);

  useEffect(() => {
    setIsConfirming(false);
    setRoutingOverride(null);
  }, [suggestion.id]);

  const primary = actions.primary;
  const isArmed = primary?.requiresConfirm === true && isConfirming;
  const choices = primary?.choices ?? [];
  const runsOn = primary?.runsOn ?? null;
  const isChoicePending = pendingChoiceIds.size > 0;

  return (
    <div
      data-testid={`next-step-${suggestion.id}`}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md bg-subtle px-2',
        compact ? 'py-1' : 'py-2',
      )}
    >
      <Icon size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', tintClasses(tone).icon)} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-row text-foreground">{suggestion.title}</span>
        {!compact && suggestion.detail != null && (
          <span className="truncate text-label text-muted-foreground">{suggestion.detail}</span>
        )}
        {!compact && runsOn !== null && (
          <NextStepRunsOn
            sessionId={suggestion.sessionId}
            kind={runsOn.kind}
            override={routingOverride}
            onChange={setRoutingOverride}
            disabled={isPending}
          />
        )}
      </span>
      {isArmed && !isPending && (
        <Button size="sm" variant="ghost" onClick={() => setIsConfirming(false)}>
          Cancel
        </Button>
      )}
      {!isArmed &&
        primary != null &&
        choices.map((choice) => {
          const isBusy = pendingChoiceIds.has(choice.id);
          const hint = [choice.description, choice.detail].filter((part) => part !== '');
          return (
            <Button
              key={choice.id}
              size="sm"
              variant="ghost"
              title={hint.length > 0 ? hint.join(', ') : undefined}
              disabled={primary.isDisabled || ((isPending || isChoicePending) && !isBusy)}
              isBusy={isBusy}
              onClick={() => {
                void choice.run();
              }}
            >
              {choiceText({ choice, choices })}
            </Button>
          );
        })}
      {primary != null && (
        <Button
          size="sm"
          variant={suggestion.band === 0 || isArmed ? 'primary' : 'secondary'}
          disabled={primary.isDisabled || (isChoicePending && !isPending)}
          isBusy={isPending}
          onClick={() => {
            if (primary.requiresConfirm === true && !isConfirming) {
              setIsConfirming(true);
              return;
            }
            setIsConfirming(false);
            if (runsOn !== null && routingOverride !== null) {
              void runsOn.runWith(routingOverride);
              return;
            }
            void primary.run();
          }}
        >
          {primary.label}
        </Button>
      )}
      <AnchoredPopover
        dropdown={dropdown}
        role="menu"
        ariaLabel={`More actions for ${suggestion.title}`}
        className="w-40 p-1"
        trigger={
          <IconButton
            icon={Ellipsis}
            label={`More actions for ${suggestion.title}`}
            variant="ghost"
            onClick={dropdown.toggle}
          />
        }
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            dropdown.close();
            onNotNow();
          }}
          className={cn(
            'flex w-full items-center rounded-md px-2 py-2 text-left text-body text-foreground',
            ROW_INTERACTIVE,
          )}
        >
          Not now
        </button>
      </AnchoredPopover>
    </div>
  );
};
