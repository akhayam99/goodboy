import { useEffect, useMemo, useState } from 'react';
import { Button, ConfirmPopover, cn, type ConfirmRole } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SUGGESTION_ICONS } from '../../suggestionIcons';
import type { NextStepBand, SessionSuggestion } from '../../types';
import type { SuggestionActions } from '../../useSuggestionActions';
import type { ActionTrack, SuggestionActionTarget } from '../../../actions/types';
import type { AgentKind, AgentKindRouting } from '../../../session/agent-kind';
import { useIsAutoOn } from '../../../auto/useIsAutoOn';
import { NextStepMenu } from './NextStepMenu';
import { NextStepRunsOn } from './NextStepRunsOn';
import { NextStepTile } from './NextStepTile';
import { NEXT_STEP_CELLS, NEXT_STEP_GRID } from './nextStepGrid';

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
  readonly isLead?: boolean;
  readonly isPending: boolean;
  readonly pendingChoiceIds?: ReadonlySet<string>;
  readonly trackChoice?: ActionTrack;
  readonly onNotNow: () => void;
};

const NO_PENDING_CHOICES: ReadonlySet<string> = new Set();

const runUntracked: ActionTrack = ({ task }) => task();

const CONFIRM_ROLE: Partial<Record<SessionSuggestion['kind'], ConfirmRole>> = {
  'close-worktree': 'danger',
};

export const NextStepRow = ({
  suggestion,
  actions,
  compact,
  isLead = false,
  isPending,
  pendingChoiceIds = NO_PENDING_CHOICES,
  trackChoice = runUntracked,
  onNotNow,
}: Props) => {
  const Icon = SUGGESTION_ICONS[suggestion.kind];
  const tone = BAND_TONE[suggestion.band];
  const [isConfirming, setIsConfirming] = useState(false);
  const [routingOverride, setRoutingOverride] = useState<AgentKindRouting | null>(null);
  const [previewKind, setPreviewKind] = useState<AgentKind | null>(null);

  useEffect(() => {
    setIsConfirming(false);
    setRoutingOverride(null);
    setPreviewKind(null);
  }, [suggestion.id]);

  const isAutoOn = useIsAutoOn();
  const primary = actions.primary;
  const shouldConfirm = primary?.requiresConfirm === true;
  const runsOn = primary?.runsOn ?? null;
  const agentKind = primary?.agentKind ?? null;
  const menuTarget = useMemo(
    (): SuggestionActionTarget => ({
      kind: 'suggestion',
      sessionId: suggestion.sessionId,
      suggestion,
      startsRole: agentKind,
      isAutoOn,
    }),
    [agentKind, isAutoOn, suggestion],
  );
  const shownKind = previewKind ?? agentKind;
  const isChoicePending = pendingChoiceIds.size > 0;
  const isActionBusy = isPending || isChoicePending || primary?.isBusy === true;

  const runPrimary = () => {
    if (primary == null) {
      return;
    }
    setIsConfirming(false);
    if (runsOn !== null && routingOverride !== null) {
      void runsOn.runWith(routingOverride);
      return;
    }
    void primary.run();
  };

  const visibleLabel = primary?.shortLabel ?? primary?.label;

  const primaryButton =
    primary == null ? null : (
      <Button
        size="sm"
        variant={isLead ? 'primary' : 'secondary'}
        className="w-full min-w-0"
        aria-label={visibleLabel === primary.label ? undefined : primary.label}
        disabled={primary.isDisabled || (isChoicePending && !isPending)}
        isBusy={isPending}
        onClick={() => {
          if (shouldConfirm) {
            setIsConfirming(true);
            return;
          }
          runPrimary();
        }}
      >
        <span className="truncate">{visibleLabel}</span>
      </Button>
    );

  return (
    <div
      data-testid={`next-step-${suggestion.id}`}
      className={cn(NEXT_STEP_GRID, compact ? 'py-1' : 'py-2')}
    >
      <NextStepTile agentKind={shownKind} fallbackIcon={Icon} tone={tone} />
      <span data-column="text" className={NEXT_STEP_CELLS.text}>
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
      <span data-column="primary" className={NEXT_STEP_CELLS.primary}>
        {primary != null && shouldConfirm ? (
          <ConfirmPopover
            role={CONFIRM_ROLE[suggestion.kind] ?? 'primary'}
            icon={<Icon size={ICON_SIZE.row} aria-hidden />}
            title={`${primary.label}?`}
            description={suggestion.title}
            confirmLabel={primary.label}
            isOpen={isConfirming}
            anchorClassName="flex w-full min-w-0 items-center"
            onConfirm={runPrimary}
            onCancel={() => setIsConfirming(false)}
            trigger={() => primaryButton}
          />
        ) : (
          primaryButton
        )}
      </span>
      <span
        data-column="not-now"
        aria-hidden={isActionBusy}
        className={cn(NEXT_STEP_CELLS.notNow, isActionBusy ? 'opacity-0' : 'opacity-100')}
      >
        <Button
          size="sm"
          variant="ghost"
          className="w-full min-w-0"
          disabled={isActionBusy}
          onClick={onNotNow}
        >
          Not now
        </Button>
      </span>
      <NextStepMenu
        target={menuTarget}
        pendingChoiceIds={pendingChoiceIds}
        isHeld={primary?.isDisabled === true || isPending || isChoicePending}
        isDisabled={isActionBusy}
        onPreview={setPreviewKind}
        trackChoice={trackChoice}
      />
    </div>
  );
};
