import type { ReactNode } from 'react';
import { ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';
import type { ArmedAction } from './armedAction';

type Props = {
  readonly armed: ArmedAction | null;
  readonly onClose: () => void;
  readonly trigger: () => ReactNode;
};

export const ArmedActionPopover = ({ armed, onClose, trigger }: Props) => {
  const confirm = armed?.action.confirm ?? null;
  const notes = confirm?.notes ?? [];
  const Icon = armed?.action.icon;
  return (
    <ConfirmPopover
      role={confirm?.role ?? 'primary'}
      icon={Icon === undefined ? null : <Icon size={ICON_SIZE.row} aria-hidden />}
      title={confirm?.title ?? ''}
      description={confirm?.description}
      confirmLabel={confirm?.confirmLabel ?? ''}
      isOpen={armed !== null && confirm !== null}
      trigger={trigger}
      note={
        notes.length === 0 ? undefined : (
          <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
            {notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        )
      }
      onConfirm={async () => {
        await armed?.run();
        onClose();
      }}
      onCancel={onClose}
    />
  );
};
