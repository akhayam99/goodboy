import { Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { ActionControls } from '../../../../actions/useActionControls';
import { RemoveWorktreeAction } from './RemoveWorktreeAction';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly label: string;
  readonly controls: ActionControls;
};

export const WorktreeRowAction = ({ sessionId, row, label, controls }: Props) => {
  const action =
    controls.inSlot({ slot: 'inline' }).find((candidate) => candidate.group !== 'open') ?? null;
  if (action === null) {
    return null;
  }
  if (action.id === 'worktree.close') {
    return <RemoveWorktreeAction sessionId={sessionId} row={row} label={label} />;
  }
  const Icon = action.icon;
  const isPending = controls.pendingId === action.id;
  const isBlocked = action.blockedReason !== null;
  const failure = controls.failure?.actionId === action.id ? controls.failure.message : null;
  const button = (
    <button
      type="button"
      disabled={isBlocked || isPending}
      aria-label={`${action.label} for ${label}`}
      aria-busy={isPending ? true : undefined}
      onClick={() => controls.trigger({ actionId: action.id })}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-label text-muted-foreground hover:bg-hover hover:text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
      )}
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      {isPending ? (action.pendingLabel ?? action.shortLabel) : action.shortLabel}
    </button>
  );
  return (
    <span className="flex min-w-0 shrink-0 items-center gap-1">
      {isBlocked ? (
        <Tooltip content={action.blockedReason}>
          <span className="inline-flex">{button}</span>
        </Tooltip>
      ) : (
        button
      )}
      {failure === null ? null : (
        <span role="status" title={failure} className="min-w-0 truncate text-secondary text-danger">
          {failure}
        </span>
      )}
    </span>
  );
};
