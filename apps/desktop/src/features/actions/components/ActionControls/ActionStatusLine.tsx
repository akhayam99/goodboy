import { Button, cn, tintClasses } from '@goodboy/ui';
import type { ActionControls } from '../../useActionControls';

type Props = {
  readonly controls: ActionControls;
  readonly showReasons?: boolean;
};

export const ActionStatusLine = ({ controls, showReasons = true }: Props) => {
  const visible = showReasons
    ? [...controls.inSlot({ slot: 'primary' }), ...controls.inSlot({ slot: 'secondary' })]
    : [];
  const reasons = [
    ...new Set(
      visible.flatMap((action) => (action.blockedReason === null ? [] : [action.blockedReason])),
    ),
  ].map((reason) => ({
    reason,
    actions: visible.filter((action) => action.blockedReason === reason),
  }));
  const failed =
    controls.failure === null
      ? null
      : (controls.actions.find((action) => action.id === controls.failure?.actionId) ?? null);
  if (reasons.length === 0 && controls.failure === null) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col items-end gap-1 text-meta">
      {reasons.map(({ reason, actions }) => (
        <p key={reason} className="min-w-0 text-right">
          <span className="text-foreground">
            {actions.map((action) => action.shortLabel).join(', ')}
          </span>{' '}
          <span className="text-muted-foreground">{reason}</span>
        </p>
      ))}
      {controls.failure !== null && (
        <div role="alert" className="flex min-w-0 items-center gap-2">
          <p className={cn('min-w-0 text-right', tintClasses('danger').text)}>
            {failed === null ? '' : `${failed.label}: `}
            {controls.failure.message}
          </p>
          <Button size="sm" variant="ghost" onClick={controls.retry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};
