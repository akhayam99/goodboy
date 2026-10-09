import { Pin, PinOff } from 'lucide-react';
import { ROW_INTERACTIVE, Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

const PIN_SLOT =
  'flex size-5 shrink-0 items-center justify-center rounded-sm text-faint-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-focus-within/select-row:opacity-100 group-hover/select-row:opacity-100';

type Props = {
  readonly isPinned: boolean;
  readonly label: string;
  readonly onToggle: () => void;
};

export const PinSlotButton = ({ isPinned, label, onToggle }: Props) => {
  const Icon = isPinned ? PinOff : Pin;
  return (
    <Tooltip content={label} side="right">
      <button
        type="button"
        data-slot="pin-toggle"
        aria-label={label}
        onClick={onToggle}
        className={cn(PIN_SLOT, ROW_INTERACTIVE)}
      >
        <Icon size={ICON_SIZE.row} aria-hidden />
      </button>
    </Tooltip>
  );
};
