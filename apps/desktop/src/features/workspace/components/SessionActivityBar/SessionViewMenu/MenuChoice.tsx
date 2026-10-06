import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly role: 'menuitemradio' | 'menuitemcheckbox';
  readonly label: string;
  readonly isChecked: boolean;
  readonly onSelect: () => void;
  readonly trailing?: ReactNode;
};

export const MenuChoice = ({ role, label, isChecked, onSelect, trailing }: Props) => (
  <button
    type="button"
    role={role}
    aria-checked={isChecked}
    onClick={onSelect}
    className={cn(
      'flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-label motion-safe:transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none',
      isChecked ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
    )}
  >
    <span className="flex w-3.5 shrink-0 items-center justify-center text-foreground">
      {isChecked ? <Check size={ICON_SIZE.row} aria-hidden /> : null}
    </span>
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {trailing}
  </button>
);
