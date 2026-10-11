import { useEffect, useState } from 'react';
import { ChoiceCards, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ActionControls } from '../../useActionControls';

type Props = {
  readonly controls: ActionControls;
};

export const ActionConfirmPanel = ({ controls }: Props) => {
  const action = controls.confirming;
  const [picked, setPicked] = useState<string | null>(null);
  const confirmingId = action?.id ?? null;

  useEffect(() => setPicked(null), [confirmingId]);

  const confirm = action?.confirm ?? null;
  const Icon = action?.icon;
  const choice = confirm?.choice ?? null;
  const selected = picked ?? choice?.defaultId ?? null;
  const notes = confirm?.notes ?? [];
  return (
    <ConfirmPopover
      isOpen={action !== null && confirm !== null}
      align="end"
      anchorClassName="absolute right-0 top-0 size-0"
      trigger={() => <span aria-hidden className="size-0" />}
      role={confirm?.role ?? 'primary'}
      icon={Icon === undefined ? null : <Icon size={ICON_SIZE.row} aria-hidden />}
      title={confirm?.title ?? ''}
      description={confirm?.description}
      confirmLabel={confirm?.confirmLabel ?? ''}
      onConfirm={() => controls.confirm({ choice: selected })}
      onCancel={controls.cancel}
      isBusy={action !== null && controls.pendingId === action.id}
      note={
        notes.length === 0 ? undefined : (
          <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
            {notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        )
      }
    >
      {choice !== null && selected !== null && (
        <ChoiceCards
          ariaLabel={choice.label}
          value={selected}
          onChange={setPicked}
          options={choice.options.map((option) => ({
            value: option.id,
            label: option.label,
            hint: option.disabledReason ?? option.detail,
            disabled: option.disabledReason !== null,
          }))}
        />
      )}
    </ConfirmPopover>
  );
};
