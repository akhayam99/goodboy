import { ChevronDown } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly label: string;
  readonly value: string;
  readonly isOpen: boolean;
  readonly isInvalid?: boolean;
  readonly disabled: boolean;
  readonly onToggle: () => void;
};

export const ControlChip = ({
  label,
  value,
  isOpen,
  isInvalid = false,
  disabled,
  onToggle,
}: Props) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={disabled}
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    aria-label={`${label}: ${value}`}
    className={cn(
      'inline-flex h-7 max-w-72 items-center gap-1.5 rounded-md border bg-subtle px-2.5 text-label transition-colors hover:bg-hover',
      isInvalid ? tintClasses('danger').borderSoft : 'border-border-soft hover:border-border',
      disabled && 'cursor-not-allowed opacity-60',
    )}
  >
    <span className="shrink-0 text-faint-foreground">{label}</span>
    <span className="min-w-0 truncate text-foreground">{value}</span>
    <ChevronDown
      size={ICON_SIZE.row}
      aria-hidden
      className={cn('shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
    />
  </button>
);
