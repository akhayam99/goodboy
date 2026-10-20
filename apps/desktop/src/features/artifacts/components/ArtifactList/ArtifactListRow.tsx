import { memo, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, InteractiveRow, Tooltip, TruncatedText, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ArtifactListRow as Row } from '../../artifactListRows';
import type { ArtifactState } from '../../artifactStateOf';
import { ARTIFACT_KIND_MARKER_LABEL } from '../../artifactPresentation';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { RelativeTime } from '../../../../shared/components/RelativeTime';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ActionControls } from '../../../actions/useActionControls';
import { useActionControls } from '../../../actions/useActionControls';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import type { ArtifactActionTarget, ResolvedAction } from '../../../actions/types';
import { ArtifactKindGlyph } from './ArtifactKindGlyph';
import { ArtifactRowConfirm } from './ArtifactRowConfirm';
import { ARTIFACT_ROW_GRID } from './artifactRowGrid';
import { ArtifactRowParts } from './ArtifactRowParts';
import { ArtifactStateBadge } from './ArtifactStateBadge';

type Props = {
  readonly row: Row;
  readonly sessionId: SessionId;
  readonly isPartsOpen: boolean;
  readonly onTogglePartsOf: (rowId: string) => void;
  readonly onOpenRow: (row: Row) => void;
  readonly hasActionColumn: boolean;
};

const PRIMARY_FALLBACK_IDS = ['artifact.stop', 'artifact.retry'] as const;

const findAction = ({
  actions,
  id,
}: {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly id: string;
}): ResolvedAction | null => actions.find((action) => action.id === id) ?? null;

const primaryOf = ({
  row,
  controls,
}: {
  readonly row: Row;
  readonly controls: ActionControls;
}): ResolvedAction | null => {
  const primary = controls.inSlot({ slot: 'primary' })[0] ?? null;
  if (primary !== null) {
    return primary;
  }
  for (const id of PRIMARY_FALLBACK_IDS) {
    const action = findAction({ actions: controls.actions, id });
    if (action !== null && row.target.kind === 'generation') {
      return action;
    }
  }
  return null;
};

const targetOf = ({
  row,
  sessionId,
}: {
  readonly row: Row;
  readonly sessionId: SessionId;
}): ArtifactActionTarget => ({
  kind: 'artifact',
  sessionId,
  subject:
    row.target.kind === 'generation'
      ? { kind: 'generation', generation: row.target.generation }
      : { kind: 'stored', artifactId: row.target.artifactId, isPlanRunning: row.isPlanRunning },
});

const GROUP_SAYS_IT: ReadonlySet<ArtifactState['key']> = new Set([
  'needs',
  'running',
  'available',
  'ran',
  'deleted',
]);

type ShownStateParams = {
  readonly row: Row;
};

const shownStateOf = ({ row }: ShownStateParams): ArtifactState | null => {
  if (row.state === null || GROUP_SAYS_IT.has(row.state.key)) {
    return null;
  }
  return row.state;
};

const RUN_PLAN_ACTION_ID = 'artifact.runPlan';

const RowComponent = ({
  row,
  sessionId,
  isPartsOpen,
  onTogglePartsOf,
  onOpenRow,
  hasActionColumn,
}: Props) => {
  const target = useMemo(() => targetOf({ row, sessionId }), [row, sessionId]);
  const planId =
    row.target.kind === 'artifact' && row.kind === 'plan' ? row.target.artifactId : null;
  const hasUnsentComments = useAppStore((state) =>
    planId === null
      ? false
      : (state.artifactComments[sessionId] ?? []).some(
          (comment) => comment.artifactId === planId && comment.status === 'draft',
        ),
  );
  const anchorKey = `artifact-row:${row.id}`;
  const menu = useObjectMenuTrigger({ target, anchorKey });
  const controls = useActionControls({ target, anchorKey });
  const isDeleted = row.group === 'deleted';
  const hasParts = row.kind === 'plan' && row.partCount > 0 && !isDeleted;
  const rowLabel = `${ARTIFACT_KIND_MARKER_LABEL[row.kind]} ${row.title}${row.state === null ? '' : `, ${row.state.label}`}`;
  const restoreAction = isDeleted
    ? findAction({ actions: controls.actions, id: 'artifact.restore' })
    : null;
  const hasOwnVerb = row.group === 'needs' || row.target.kind === 'generation';
  const primary = hasOwnVerb ? primaryOf({ row, controls }) : null;
  const isFilled =
    primary !== null &&
    primary.slot === 'primary' &&
    !(primary.id === RUN_PLAN_ACTION_ID && hasUnsentComments);
  const state = shownStateOf({ row });
  const at = row.deletedAt ?? row.at;
  const atTitle =
    at === null
      ? undefined
      : `${isDeleted ? 'Deleted ' : ''}${formatDateTime({ at, hasYear: true })}`;

  return (
    <div className="@container relative flex min-w-0 flex-col" data-testid="artifact-row-frame">
      <InteractiveRow
        menu={menu}
        label={rowLabel}
        isSelected={false}
        onOpen={() => onOpenRow(row)}
        dataAttributes={{ 'data-artifact-row': row.id }}
        frameClassName="group"
        className={ARTIFACT_ROW_GRID.frame}
      >
        {hasParts ? (
          <Tooltip content="Parts">
            <button
              type="button"
              aria-expanded={isPartsOpen}
              aria-label={`${isPartsOpen ? 'Hide' : 'Show'} parts of ${row.title}`}
              onClick={() => onTogglePartsOf(row.id)}
              className={cn(
                ARTIFACT_ROW_GRID.lead,
                'grid place-items-center rounded-sm text-faint-foreground hover:bg-hover hover:text-foreground',
              )}
            >
              <ChevronRight
                size={ICON_SIZE.control}
                aria-hidden
                className={cn('motion-safe:transition-transform', isPartsOpen && 'rotate-90')}
              />
            </button>
          </Tooltip>
        ) : (
          <span aria-hidden className={ARTIFACT_ROW_GRID.lead} />
        )}
        <ArtifactKindGlyph
          kind={row.kind}
          size={ICON_SIZE.control}
          className={cn(ARTIFACT_ROW_GRID.glyph, row.isFaint && 'text-faint-foreground')}
        />
        <TruncatedText
          className={cn(
            ARTIFACT_ROW_GRID.title,
            row.isFaint ? 'text-faint-foreground' : 'text-foreground',
          )}
        >
          {row.title}
        </TruncatedText>
        <span className={cn(ARTIFACT_ROW_GRID.state, row.isFaint && 'opacity-80')}>
          {state === null ? null : <ArtifactStateBadge state={state} />}
        </span>
        <span data-testid="artifact-row-time" className={ARTIFACT_ROW_GRID.date}>
          {at === null ? null : <RelativeTime iso={at} title={atTitle} />}
        </span>
        {hasActionColumn ? (
          <span data-testid="artifact-row-action" className={ARTIFACT_ROW_GRID.action}>
            {restoreAction === null ? null : (
              <Button
                size="sm"
                variant="secondary"
                isBusy={controls.pendingId === restoreAction.id}
                onClick={() => controls.trigger({ actionId: restoreAction.id })}
              >
                Restore
              </Button>
            )}
            {primary === null ? null : (
              <Button
                size="sm"
                variant="secondary"
                disabled={primary.blockedReason !== null}
                isBusy={controls.pendingId === primary.id}
                title={primary.blockedReason ?? primary.description ?? undefined}
                data-filled={isFilled ? 'true' : 'false'}
                onClick={() => controls.trigger({ actionId: primary.id })}
              >
                {primary.shortLabel}
              </Button>
            )}
          </span>
        ) : null}
      </InteractiveRow>
      <ArtifactRowConfirm controls={controls} />
      {controls.failure === null ? null : (
        <p role="alert" className="px-8 pb-1 text-meta text-danger">
          {controls.failure.message}
        </p>
      )}
      {hasParts && isPartsOpen ? (
        <ArtifactRowParts parts={row.parts} hasActionColumn={hasActionColumn} />
      ) : null}
    </div>
  );
};

export const ArtifactListRow = memo(RowComponent);
