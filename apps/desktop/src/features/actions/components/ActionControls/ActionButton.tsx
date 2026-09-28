import { Button, GhostActionButton, Tooltip } from '@goodboy/ui';
import type { ActionControls } from '../../useActionControls';
import type { ResolvedAction } from '../../types';

type Props = {
  readonly action: ResolvedAction;
  readonly controls: ActionControls;
  readonly variant: 'primary' | 'secondary';
};

export const ActionButton = ({ action, controls, variant }: Props) => {
  const isPending = controls.pendingId === action.id;
  const isBlocked = action.blockedReason !== null;
  const onClick = () => controls.trigger({ actionId: action.id });
  if (variant === 'secondary' && action.group === 'open') {
    return (
      <GhostActionButton
        icon={action.icon}
        label={action.shortLabel}
        ariaLabel={action.label}
        disabled={isBlocked}
        isBusy={isPending}
        {...(action.pendingLabel !== null && { busyLabel: action.pendingLabel })}
        onClick={onClick}
      />
    );
  }
  const button = (
    <Button
      size="sm"
      variant={variant}
      aria-label={action.label}
      aria-describedby={isBlocked ? `${action.id}-reason` : undefined}
      disabled={isBlocked || (controls.pendingId !== null && !isPending)}
      isBusy={isPending}
      {...(action.pendingLabel !== null && { busyLabel: action.pendingLabel })}
      onClick={onClick}
    >
      {action.shortLabel}
    </Button>
  );
  if (!isBlocked) {
    return button;
  }
  return (
    <Tooltip content={action.blockedReason} anchorClassName="shrink-0">
      <span className="inline-flex">{button}</span>
    </Tooltip>
  );
};
