import type { LucideIcon } from 'lucide-react';
import { Button, ConfirmPopover, IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { ActionControls } from '../../../../actions/useActionControls';

type Props = {
  readonly controls: ActionControls;
  readonly actionId: 'mount.close' | 'mount.forget' | 'mount.removeGone';
  readonly label: string;
  readonly glyph: LucideIcon;
  readonly isLabelShown?: boolean;
};

export const MountConfirmAction = ({
  controls,
  actionId,
  label,
  glyph,
  isLabelShown = false,
}: Props) => {
  const action = controls.actions.find((candidate) => candidate.id === actionId) ?? null;
  const confirm = action?.confirm ?? null;
  if (action === null || confirm === null) {
    return null;
  }
  const isBlocked = action.blockedReason !== null;
  const notes = confirm.notes ?? [];
  const name = `${action.label} for ${label}`;
  const Glyph = action.icon;

  return (
    <ConfirmPopover
      role={confirm.role}
      icon={<Glyph size={ICON_SIZE.row} aria-hidden />}
      title={confirm.title}
      description={confirm.description}
      confirmLabel={confirm.confirmLabel}
      align="end"
      isOpen={controls.confirming?.id === actionId}
      isBusy={controls.pendingId === actionId}
      note={
        notes.length === 0 ? undefined : (
          <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
            {notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        )
      }
      onConfirm={() => controls.confirm()}
      onCancel={controls.cancel}
      trigger={() =>
        isLabelShown ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={name}
            aria-disabled={isBlocked ? true : undefined}
            aria-haspopup="dialog"
            onClick={() => controls.trigger({ actionId })}
          >
            {action.label}
          </Button>
        ) : (
          <IconButton
            size="xs"
            variant="ghost"
            icon={glyph}
            iconSize={ICON_SIZE.row}
            label={name}
            tooltip={action.blockedReason ?? action.label}
            aria-disabled={isBlocked ? true : undefined}
            busy={controls.pendingId === actionId}
            aria-haspopup="dialog"
            onClick={() => controls.trigger({ actionId })}
          />
        )
      }
    />
  );
};
