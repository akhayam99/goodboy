import { Button, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { actionButtonStateOf } from '../../actions/actionButtonStateOf';
import type { ResolvedAction } from '../../actions/types';
import type { ActionControls } from '../../actions/useActionControls';

type Props = {
  readonly controls: ActionControls;
  readonly action: ResolvedAction | undefined;
  readonly label: string;
  readonly variant: 'primary' | 'secondary' | 'ghost';
  readonly className?: string;
};

export const RebasePromptVerb = ({ controls, action, label, variant, className }: Props) => {
  if (action === undefined) {
    return null;
  }
  const state = actionButtonStateOf({
    controls,
    actionId: action.id,
    label,
    pendingLabel: action.pendingLabel,
  });
  const button = (
    <Button
      size="sm"
      variant={variant}
      className={className}
      data-rebase-verb={action.id}
      disabled={action.blockedReason !== null || controls.pendingId !== null}
      isBusy={state.isPending}
      onClick={() => controls.trigger({ actionId: action.id })}
    >
      <action.icon size={ICON_SIZE.row} aria-hidden />
      {state.label}
    </Button>
  );
  if (action.blockedReason === null) {
    return button;
  }
  return (
    <Tooltip content={action.blockedReason}>
      <span className="inline-flex">{button}</span>
    </Tooltip>
  );
};
