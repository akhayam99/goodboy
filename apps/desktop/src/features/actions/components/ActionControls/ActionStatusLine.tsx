import { Button, cn, tintClasses } from '@goodboy/ui';
import type { ActionControls } from '../../useActionControls';

type Props = {
  readonly controls: ActionControls;
};

export const ActionStatusLine = ({ controls }: Props) => {
  const visible = [
    ...controls.inSlot({ slot: 'primary' }),
    ...controls.inSlot({ slot: 'secondary' }),
  ];
  const blocked = visible.filter((action) => action.blockedReason !== null);
  const failed =
    controls.failure === null
      ? null
      : (controls.actions.find((action) => action.id === controls.failure?.actionId) ?? null);
  if (blocked.length === 0 && controls.failure === null) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col items-end gap-1 text-secondary">
      {blocked.map((action) => (
        <p key={action.id} id={`${action.id}-reason`} className="min-w-0 text-right">
          <span className="font-medium text-foreground">{action.label}</span>{' '}
          <span className="text-muted-foreground">{action.blockedReason}</span>
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
