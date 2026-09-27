import { Button, Tooltip } from '@goodboy/ui';
import type { ResolveItemAction, ResolveItemActionId } from '../../resolveItemActions';

type Props = {
  readonly action: ResolveItemAction;
  readonly isPrimary: boolean;
  readonly isBusy: boolean;
  readonly onAction: (id: ResolveItemActionId) => void;
};

export const ActionButton = ({ action, isPrimary, isBusy, onAction }: Props) => (
  <Tooltip content={action.disabledReason ?? action.label}>
    <Button
      size="sm"
      variant={isPrimary ? 'primary' : 'ghost'}
      {...(isPrimary && { 'data-resolve-primary': true })}
      disabled={action.disabledReason !== null}
      isBusy={isBusy}
      onClick={() => onAction(action.id)}
    >
      {action.label}
    </Button>
  </Tooltip>
);
