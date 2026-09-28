import { InlineConfirm } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ActionControls } from '../../useActionControls';

type Props = {
  readonly controls: ActionControls;
};

export const ActionConfirmPanel = ({ controls }: Props) => {
  const action = controls.confirming;
  if (action === null || action.confirm === null) {
    return null;
  }
  const Icon = action.icon;
  return (
    <InlineConfirm
      role={action.confirm.role}
      icon={<Icon size={ICON_SIZE.row} aria-hidden />}
      title={action.confirm.title}
      description={action.confirm.description}
      confirmLabel={action.confirm.confirmLabel}
      onConfirm={controls.confirm}
      onCancel={controls.cancel}
      isBusy={controls.pendingId === action.id}
      note={
        (action.confirm.notes ?? []).length === 0 ? undefined : (
          <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
            {(action.confirm.notes ?? []).map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        )
      }
    />
  );
};
