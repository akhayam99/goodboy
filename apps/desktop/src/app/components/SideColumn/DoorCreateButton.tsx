import { Plus } from 'lucide-react';
import { IconButton } from '@goodboy/ui';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly shortcut?: string;
  readonly onCreate: () => void;
};

export const DoorCreateButton = ({ id, label, shortcut, onCreate }: Props) => (
  <div className="absolute right-0.5 top-0.5 flex size-6 items-center justify-center">
    <IconButton
      icon={Plus}
      label={label}
      {...(shortcut !== undefined && { shortcut })}
      tooltipSide="right"
      size="xs"
      data-door-create={id}
      onClick={onCreate}
      className="text-faint-foreground"
    />
  </div>
);
