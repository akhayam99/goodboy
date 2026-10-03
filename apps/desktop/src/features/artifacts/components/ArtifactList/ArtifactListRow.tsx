import { memo, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, IconButton, InteractiveRow, InlineConfirm, Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ArtifactListRow as Row } from '../../artifactListRows';
import { ARTIFACT_KIND_MARKER_LABEL } from '../../artifactPresentation';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { RelativeTime } from '../../../../shared/components/RelativeTime';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ArtifactOverflowMenu } from '../ArtifactShell/ArtifactOverflowMenu';
import type { ActionControls } from '../../../actions/useActionControls';
import { useActionControls } from '../../../actions/useActionControls';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import type { ArtifactActionTarget, ResolvedAction } from '../../../actions/types';
import { ArtifactKindGlyph } from './ArtifactKindGlyph';
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

const RowComponent = ({ row, sessionId, isPartsOpen, onTogglePartsOf, onOpenRow }: Props) => {
  const target = useMemo(() => targetOf({ row, sessionId }), [row, sessionId]);
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
  const hover = isDeleted ? [] : hoverActionsOf({ row, actions: controls.actions });
  const at = row.deletedAt ?? row.at;
  const atTitle =
    at === null
      ? undefined
      : `${isDeleted ? 'Deleted ' : ''}${formatDateTime({ at, hasYear: true })}`;

  return (
    <div className="flex min-w-0 flex-col" data-testid="artifact-row-frame">
      <InteractiveRow
        menu={menu}
        label={rowLabel}
        isSelected={false}
        onOpen={() => onOpenRow(row)}
        dataAttributes={{ 'data-artifact-row': row.id }}
        frameClassName="@container group"
        className="flex min-h-9 min-w-0 items-center gap-2.5 pr-1.5 pl-0.5"
      >
        {hasParts ? (
          <Tooltip content="Parts">
            <button
              type="button"
              aria-expanded={isPartsOpen}
              aria-label={`${isPartsOpen ? 'Hide' : 'Show'} parts of ${row.title}`}
              onClick={() => onTogglePartsOf(row.id)}
              className="grid size-[18px] shrink-0 place-items-center rounded-sm text-faint-foreground hover:bg-hover hover:text-foreground"
            >
              <ChevronRight
                size={ICON_SIZE.control}
                aria-hidden
                className={cn('motion-safe:transition-transform', isPartsOpen && 'rotate-90')}
              />
            </button>
          </Tooltip>
        ) : (
          <span aria-hidden className="size-[18px] shrink-0" />
        )}
        <ArtifactKindGlyph
          kind={row.kind}
          size={ICON_SIZE.control}
          className={cn('w-5', row.isFaint && 'text-faint-foreground')}
        />
        <span
          title={row.title}
          className={cn(
            'min-w-16 flex-1 truncate text-row',
            row.isFaint ? 'text-faint-foreground' : 'text-foreground',
          )}
        >
          {row.title}
        </span>
        <span
          className={cn(
            'flex w-52 min-w-0 shrink-0 items-center @max-[560px]:w-32 @max-[400px]:hidden',
            row.isFaint && 'opacity-80',
          )}
        >
          {row.state === null ? null : <ArtifactStateBadge state={row.state} />}
        </span>
        <span
          data-testid="artifact-row-time"
          className="w-[72px] shrink-0 text-right text-secondary tabular-nums text-faint-foreground @max-[480px]:hidden"
        >
          {at === null ? null : <RelativeTime iso={at} title={atTitle} />}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {isDeleted ? null : (
            <span className="mr-1 flex w-[92px] justify-end @max-[400px]:w-16">
              {primary === null ? null : (
                <Button
                  size="sm"
                  variant={primary.slot === 'primary' ? 'primary' : 'secondary'}
                  emphasis={primary.slot === 'primary' ? 'outline' : 'solid'}
                  disabled={primary.blockedReason !== null}
                  isBusy={controls.pendingId === primary.id}
                  title={primary.blockedReason ?? primary.description ?? undefined}
                  onClick={() => controls.trigger({ actionId: primary.id })}
                >
                  {primary.shortLabel}
                </Button>
              )}
            </span>
          )}
          {isDeleted ? null : (
            <span className="pointer-events-none flex w-[84px] shrink-0 items-center justify-end opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 @max-[560px]:hidden">
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
          )}
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
          {isDeleted ? null : (
            <span className="flex w-8 shrink-0 justify-center">
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
          )}
          {isDeleted ? null : (
            <ArtifactOverflowMenu
              target={target}
              anchorKey={anchorKey}
              label={`More for ${row.title}`}
            />
          )}
        </span>
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
        <p role="alert" className="px-8 pb-1 text-secondary text-danger">
          {controls.failure.message}
        </p>
      )}
      {hasParts && isPartsOpen ? <ArtifactRowParts parts={row.parts} /> : null}
    </div>
  );
};

export const ArtifactListRow = memo(RowComponent);
