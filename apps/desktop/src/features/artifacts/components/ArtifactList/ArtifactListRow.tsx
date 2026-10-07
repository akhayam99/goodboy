import { memo, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, IconButton, InteractiveRow, InlineConfirm, Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ArtifactListRow as Row } from '../../artifactListRows';
import { ARTIFACT_KIND_MARKER_LABEL } from '../../artifactPresentation';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { RelativeTime } from '../../../../shared/components/RelativeTime';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ArtifactOverflowMenu } from '../ArtifactShell/ArtifactOverflowMenu';
import type { ActionControls } from '../../../actions/useActionControls';
import { useActionControls } from '../../../actions/useActionControls';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import type { ArtifactActionTarget, ResolvedAction } from '../../../actions/types';
import { ArtifactKindGlyph } from './ArtifactKindGlyph';
import { ARTIFACT_ROW_GRID } from './artifactRowGrid';
import { ArtifactRowParts } from './ArtifactRowParts';
import { ArtifactStateBadge } from './ArtifactStateBadge';

type Props = {
  readonly row: Row;
  readonly sessionId: SessionId;
  readonly isPartsOpen: boolean;
  readonly onTogglePartsOf: (rowId: string) => void;
  readonly onOpenRow: (row: Row) => void;
};

const HOVER_ACTION_IDS = [
  'artifact.edit',
  'artifact.openInBrowser',
  'artifact.copySource',
] as const;

const PRIMARY_FALLBACK_IDS = ['artifact.stop', 'artifact.retry'] as const;

const findAction = ({
  actions,
  id,
}: {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly id: string;
}): ResolvedAction | null => actions.find((action) => action.id === id) ?? null;

const hoverActionsOf = ({
  row,
  actions,
}: {
  readonly row: Row;
  readonly actions: ReadonlyArray<ResolvedAction>;
}): ReadonlyArray<ResolvedAction> =>
  HOVER_ACTION_IDS.flatMap((id) => {
    const action = findAction({ actions, id });
    if (action === null || (id === 'artifact.openInBrowser' && row.kind !== 'wireframe')) {
      return [];
    }
    return [action];
  });

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

const RUN_PLAN_ACTION_ID = 'artifact.runPlan';

const RowComponent = ({ row, sessionId, isPartsOpen, onTogglePartsOf, onOpenRow }: Props) => {
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
  const { confirming } = controls;
  const isDeleted = row.group === 'deleted';
  const hasParts = row.kind === 'plan' && row.partCount > 0 && !isDeleted;
  const rowLabel = `${ARTIFACT_KIND_MARKER_LABEL[row.kind]} ${row.title}${row.state === null ? '' : `, ${row.state.label}`}`;
  const deleteAction = isDeleted
    ? null
    : findAction({ actions: controls.actions, id: 'artifact.delete' });
  const restoreAction = isDeleted
    ? findAction({ actions: controls.actions, id: 'artifact.restore' })
    : null;
  const permanentAction = isDeleted
    ? findAction({ actions: controls.actions, id: 'artifact.deletePermanently' })
    : null;
  const primary = isDeleted ? null : primaryOf({ row, controls });
  const isFilled =
    primary !== null &&
    primary.slot === 'primary' &&
    !(primary.id === RUN_PLAN_ACTION_ID && hasUnsentComments);
  const hover = isDeleted ? [] : hoverActionsOf({ row, actions: controls.actions });
  const at = row.deletedAt ?? row.at;
  const atTitle =
    at === null
      ? undefined
      : `${isDeleted ? 'Deleted ' : ''}${formatDateTime({ at, hasYear: true })}`;

  return (
    <div className="@container flex min-w-0 flex-col" data-testid="artifact-row-frame">
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
        <span
          title={row.title}
          className={cn(
            ARTIFACT_ROW_GRID.title,
            row.isFaint ? 'text-faint-foreground' : 'text-foreground',
          )}
        >
          {row.title}
        </span>
        <span className={cn(ARTIFACT_ROW_GRID.state, row.isFaint && 'opacity-80')}>
          {row.state === null ? null : <ArtifactStateBadge state={row.state} />}
        </span>
        <span data-testid="artifact-row-time" className={ARTIFACT_ROW_GRID.date}>
          {at === null ? null : <RelativeTime iso={at} title={atTitle} />}
        </span>
        {isDeleted ? (
          <span className={ARTIFACT_ROW_GRID.deletedTail}>
            <span className={ARTIFACT_ROW_GRID.primary}>
              {restoreAction === null ? null : (
                <Button
                  size="sm"
                  variant="secondary"
                  emphasis="solid"
                  isBusy={controls.pendingId === restoreAction.id}
                  onClick={() => controls.trigger({ actionId: restoreAction.id })}
                >
                  Restore
                </Button>
              )}
            </span>
            <span className={ARTIFACT_ROW_GRID.deleted}>
              {permanentAction === null ? null : (
                <Button
                  size="sm"
                  variant="danger"
                  emphasis="outline"
                  isBusy={controls.pendingId === permanentAction.id}
                  onClick={() => controls.trigger({ actionId: permanentAction.id })}
                >
                  Delete permanently
                </Button>
              )}
            </span>
          </span>
        ) : (
          <span className={ARTIFACT_ROW_GRID.tail}>
            <span className={ARTIFACT_ROW_GRID.primary}>
              {primary === null ? null : (
                <Button
                  size="sm"
                  variant={isFilled ? 'primary' : 'secondary'}
                  emphasis={isFilled ? 'outline' : 'solid'}
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
            <span className={ARTIFACT_ROW_GRID.hover}>
              {hover.map((action) => (
                <IconButton
                  key={action.id}
                  icon={action.icon}
                  iconSize={ICON_SIZE.control}
                  label={action.label}
                  tooltip={action.blockedReason ?? action.label}
                  variant="ghost"
                  disabled={action.blockedReason !== null}
                  onClick={() => controls.trigger({ actionId: action.id })}
                />
              ))}
            </span>
            <span className={ARTIFACT_ROW_GRID.remove}>
              {deleteAction === null ? null : (
                <IconButton
                  icon={deleteAction.icon}
                  iconSize={ICON_SIZE.control}
                  label={`Delete ${row.title}`}
                  tooltip="Delete"
                  variant="ghost"
                  disabled={deleteAction.blockedReason !== null}
                  onClick={() => controls.trigger({ actionId: deleteAction.id })}
                />
              )}
            </span>
            <span className={ARTIFACT_ROW_GRID.menu}>
              <ArtifactOverflowMenu
                target={target}
                anchorKey={anchorKey}
                label={`More for ${row.title}`}
              />
            </span>
          </span>
        )}
      </InteractiveRow>
      {confirming === null || confirming.confirm === null ? null : (
        <InlineConfirm
          role={confirming.confirm.role}
          icon={<confirming.icon size={ICON_SIZE.row} aria-hidden />}
          title={confirming.confirm.title}
          description={confirming.confirm.description}
          confirmLabel={confirming.confirm.confirmLabel}
          onConfirm={controls.confirm}
          onCancel={controls.cancel}
          isBusy={controls.pendingId === confirming.id}
        />
      )}
      {controls.failure === null ? null : (
        <p role="alert" className="px-8 pb-1 text-meta text-danger">
          {controls.failure.message}
        </p>
      )}
      {hasParts && isPartsOpen ? <ArtifactRowParts parts={row.parts} /> : null}
    </div>
  );
};

export const ArtifactListRow = memo(RowComponent);
