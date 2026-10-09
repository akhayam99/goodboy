import type { RefObject } from 'react';
import { InlineConfirm } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';
import { HeaderPanel } from '../HeaderPanel';
import type { ArmedAction } from './armedAction';

type Props = {
  readonly armed: ArmedAction | null;
  readonly triggerWithin: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
};

export const HeaderConfirm = ({ armed, triggerWithin, onClose }: Props) => {
  const confirm = armed?.action.confirm ?? null;
  if (armed === null || confirm === null) {
    return null;
  }
  const Icon = armed.action.icon;
  return (
    <HeaderPanel triggerWithin={triggerWithin} onClose={onClose}>
      <InlineConfirm
        role={confirm.role}
        icon={<Icon size={ICON_SIZE.row} aria-hidden />}
        title={confirm.title}
        description={confirm.description}
        confirmLabel={confirm.confirmLabel}
        note={
          (confirm.notes ?? []).length === 0 ? undefined : (
            <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
              {(confirm.notes ?? []).map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )
        }
        onConfirm={async () => {
          await armed.run();
          onClose();
        }}
        onCancel={onClose}
      />
    </HeaderPanel>
  );
};
