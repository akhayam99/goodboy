import { useState, type ReactNode } from 'react';
import { Button, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { RebaseStopRowFor } from '../../../history/useRebaseStopRows';
import { NextStepRebasePicker } from '../../../suggestions/NextStepRebasePicker';
import { ActionCard } from './ActionCard';
import type { ActionCardModel } from './actionCardsOf';
import { ROW_COLUMNS } from '../rowColumns';
import { nextBulkOf } from './nextBulkOf';
import type { NextGroupModel } from './nextGroupsOf';
import type { ActionCardActions } from './useActionCardActions';

type CardParams = {
  readonly card: ActionCardModel;
};

type Props = {
  readonly group: NextGroupModel;
  readonly hasLabel: boolean;
  readonly isLead: boolean;
  readonly isNarrow: boolean;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor?: ActionCardActions['openFor'];
  readonly chipFor?: (params: CardParams) => ReactNode;
  readonly sessionId?: SessionId;
  readonly stopRowFor?: RebaseStopRowFor;
};

export const NextGroup = ({
  group,
  hasLabel,
  isLead,
  isNarrow,
  actionsFor,
  openFor,
  chipFor,
  sessionId,
  stopRowFor,
}: Props) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const isUpdating = useAppStore((state) => {
    const run = sessionId === undefined ? undefined : state.rebaseAllRuns[sessionId];
    return run !== undefined && (run.phase === 'running' || run.phase === 'handing');
  });
  const updateAll = useAppStore((state) => state.updateAll);
  const shown = group.rows.map((card) => ({ card, actions: actionsFor({ card, isNarrow }) }));
  const hasOverflowColumn = shown.some(
    ({ actions }) => actions.menu !== null || actions.foldedTarget !== null,
  );
  const bulk = nextBulkOf({ group, sessionId, stopRowFor });
  const retries =
    bulk?.kind === 'retry' ? bulk.cards.map((card) => actionsFor({ card, isNarrow })) : [];
  const updateButton =
    bulk?.kind === 'update' ? (
      <Button
        size="sm"
        variant="secondary"
        aria-label={`${bulk.label} branches`}
        isBusy={isUpdating}
        onClick={() => {
          if (isUpdating) {
            return;
          }
          void updateAll({
            sessionId: bulk.sessionId,
            rebaseMountIds: bulk.rebaseMountIds,
            bringInMountIds: bulk.bringInMountIds,
          });
        }}
      >
        {bulk.label}
      </Button>
    ) : null;
  const bulkButton =
    bulk === null ? undefined : bulk.kind === 'update' ? (
      updateButton
    ) : bulk.kind === 'retry' ? (
      <Button
        size="sm"
        variant="secondary"
        aria-label={`Retry the ${bulk.cards.length} stuck agents`}
        isBusy={retries.some((actions) => actions.isBusy)}
        onClick={() => {
          for (const actions of retries) {
            actions.main?.run();
          }
        }}
      >
        {bulk.label}
      </Button>
    ) : (
      <Button
        size="sm"
        variant="secondary"
        aria-expanded={isPickerOpen}
        onClick={() => setIsPickerOpen((isShown) => !isShown)}
      >
        {bulk.label}
      </Button>
    );
  return (
    <section
      aria-label={group.label}
      data-next-group={group.id}
      className="flex min-w-0 flex-col gap-1"
    >
      {hasLabel || bulkButton !== undefined ? (
        <div
          data-next-group-head=""
          className={cn(
            'flex min-h-7 min-w-0 items-center justify-between',
            ROW_COLUMNS.gap,
            ROW_COLUMNS.inset,
          )}
        >
          {hasLabel ? (
            <span className="flex min-w-0 items-baseline gap-2 text-meta text-muted-foreground">
              <span>{group.label}</span>
              <span className="tabular-nums text-faint-foreground">{group.rows.length}</span>
            </span>
          ) : (
            <span />
          )}
          {bulkButton}
        </div>
      ) : null}
      {shown.map(({ card, actions }, index) => (
        <ActionCard
          key={card.id}
          card={card}
          actions={actions}
          isFirst={isLead && index === 0}
          hasOverflowColumn={hasOverflowColumn}
          chip={chipFor?.({ card })}
          onOpen={openFor?.({ card }) ?? null}
        />
      ))}
      {bulk?.kind === 'rebase' && isPickerOpen ? (
        <NextStepRebasePicker
          sessionId={bulk.sessionId}
          targets={bulk.targets}
          onClose={() => setIsPickerOpen(false)}
        />
      ) : null}
    </section>
  );
};
