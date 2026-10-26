import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, cn, ICON_SIZE, tintClasses } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly value: string;
  readonly display?: ReactNode;
  readonly suffix?: string | null;
  readonly marker?: ReactNode;
  readonly isOpen: boolean;
  readonly isInvalid?: boolean;
  readonly isDisabled: boolean;
  readonly onToggle: () => void;
};

export const ControlChip = ({
  label,
  value,
  display = null,
  suffix = null,
  marker = null,
  isOpen,
  isInvalid = false,
  isDisabled,
  onToggle,
}: Props) => (
  <Button
    variant="secondary"
    size="sm"
    onClick={onToggle}
    disabled={isDisabled}
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    aria-label={`${label}: ${suffix === null ? value : `${value}, ${suffix}`}`}
    className={cn(
      'max-w-72 justify-start bg-subtle font-normal',
      isInvalid ? tintClasses('danger').borderSoft : 'border-border-soft hover:border-border',
    )}
  >
    <span className="shrink-0 text-faint-foreground">{label}</span>
    {marker}
    {display === null ? (
      <span className="min-w-0 truncate text-foreground">{value}</span>
    ) : (
      <span className="flex min-w-0 items-center text-foreground">{display}</span>
    )}
    {suffix === null ? null : (
      <span className="shrink-0 text-faint-foreground">{`· ${suffix}`}</span>
    )}
    <ChevronDown
      size={ICON_SIZE.row}
      aria-hidden
      className={cn('shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
    />
  </Button>
);
