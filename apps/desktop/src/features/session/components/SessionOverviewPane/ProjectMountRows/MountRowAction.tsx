import { Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { ActionControls } from '../../../../actions/useActionControls';

type Props = {
  readonly label: string;
  readonly controls: ActionControls;
};

export const MountRowAction = ({ label, controls }: Props) => {
  const action =
    controls
      .inSlot({ slot: 'inline' })
      .find((candidate) => candidate.group !== 'open' && candidate.id !== 'mount.close') ?? null;
  if (action === null) {
    return null;
  }
  const Icon = action.icon;
  const isPending = controls.pendingId === action.id;
  const isBlocked = action.blockedReason !== null;
  const button = (
    <button
      type="button"
      disabled={isBlocked || isPending}
      aria-label={`${action.label} for ${label}`}
      aria-busy={isPending ? true : undefined}
      onClick={() => controls.trigger({ actionId: action.id })}
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-label text-muted-foreground hover:bg-hover hover:text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
      )}
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="truncate">
        {isPending ? (action.pendingLabel ?? action.shortLabel) : action.shortLabel}
      </span>
    </button>
  );
  return isBlocked ? (
    <Tooltip content={action.blockedReason}>
      <span className="inline-flex min-w-0">{button}</span>
    </Tooltip>
  ) : (
    button
  );
};
