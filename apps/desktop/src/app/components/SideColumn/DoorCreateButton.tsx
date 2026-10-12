import { Plus } from 'lucide-react';
import { IconButton, cn } from '@goodboy/ui';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly shortcut?: string;
  readonly isVisible: boolean;
  readonly onCreate: () => void;
};

export const DoorCreateButton = ({ id, label, shortcut, isVisible, onCreate }: Props) => (
  <div
    className={cn(
      'absolute right-0.5 top-0.5 flex size-6 items-center justify-center',
      'focus-within:opacity-100 group-focus-within/door:opacity-100 group-hover/door:opacity-100',
      isVisible ? 'opacity-100' : 'opacity-0',
    )}
  >
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
