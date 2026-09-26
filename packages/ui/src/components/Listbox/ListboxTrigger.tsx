import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';
import { chipClasses } from '../Chip';
import type { ListboxSize, ListboxTriggerVariant } from './listboxTypes';

export type ListboxTriggerProps = {
  readonly variant: ListboxTriggerVariant;
  readonly size: ListboxSize;
  readonly isOpen: boolean;
  readonly disabled: boolean;
  readonly isBlock: boolean;
  readonly id?: string;
  readonly ariaLabel?: string;
  readonly listboxId: string;
  readonly activeDescendant?: string;
  readonly buttonRef: Ref<HTMLButtonElement>;
  readonly className?: string;
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

const FIELD_SIZE: Record<ListboxSize, string> = {
  sm: 'h-7 px-2 text-label',
  md: 'h-8 px-2.5 text-body',
};

const QUIET_SIZE: Record<ListboxSize, string> = {
  sm: 'h-6 px-1.5 text-label',
  md: 'h-7 px-2 text-body',
};

const variantClasses = ({
  variant,
  size,
  isOpen,
  disabled,
}: Pick<ListboxTriggerProps, 'variant' | 'size' | 'isOpen' | 'disabled'>): string => {
  if (variant === 'chip') {
    return cn(
      chipClasses({ tone: 'neutral', size: 'control', shape: 'badge', isInteractive: true }),
      'max-w-72',
    );
  }
  if (variant === 'quiet') {
    return cn(
      'gap-1 rounded-md',
      QUIET_SIZE[size],
      disabled
        ? 'text-disabled-foreground'
        : 'text-muted-foreground hover:bg-hover hover:text-foreground',
      isOpen && 'bg-hover text-foreground',
    );
  }
  return cn(
    'gap-1.5 rounded-md border bg-transparent',
    FIELD_SIZE[size],
    disabled
      ? 'border-border-soft text-disabled-foreground'
      : 'border-border text-foreground hover:border-border-strong',
    isOpen && 'border-border-strong',
  );
};

export const ListboxTrigger = ({
  variant,
  size,
  isOpen,
  disabled,
  isBlock,
  id,
  ariaLabel,
  listboxId,
  activeDescendant,
  buttonRef,
  className,
  children,
  onClick,
  onKeyDown,
}: ListboxTriggerProps) => (
  <button
    ref={buttonRef}
    id={id}
    type="button"
    role="combobox"
    aria-label={ariaLabel}
    aria-haspopup="listbox"
    aria-expanded={isOpen}
    aria-controls={isOpen ? listboxId : undefined}
    aria-activedescendant={activeDescendant}
    disabled={disabled}
    onClick={onClick}
    onKeyDown={onKeyDown}
    className={cn(
      'min-w-0 items-center text-left motion-safe:transition-colors disabled:cursor-not-allowed',
      FOCUS_RING,
      isBlock ? 'flex w-full' : 'inline-flex',
      variantClasses({ variant, size, isOpen, disabled }),
      className,
    )}
  >
    <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">{children}</span>
    <ChevronDown
      size={12}
      aria-hidden
      className={cn(
        'shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-120',
        isOpen && 'rotate-180',
      )}
    />
  </button>
);
