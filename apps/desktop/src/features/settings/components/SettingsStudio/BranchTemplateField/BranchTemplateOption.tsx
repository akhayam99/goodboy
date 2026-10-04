import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly label: ReactNode;
  readonly isMono: boolean;
  readonly hint: string;
  readonly isChecked: boolean;
  readonly isDisabled: boolean;
  readonly onPick: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly buttonRef: Ref<HTMLButtonElement>;
};

export const BranchTemplateOption = ({
  label,
  isMono,
  hint,
  isChecked,
  isDisabled,
  onPick,
  onKeyDown,
  buttonRef,
}: Props) => (
  <button
    ref={buttonRef}
    type="button"
    role="radio"
    aria-checked={isChecked}
    tabIndex={isChecked ? 0 : -1}
    disabled={isDisabled}
    onClick={onPick}
    onKeyDown={onKeyDown}
    className={cn(
      'flex min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50',
      isChecked && 'bg-selected',
    )}
  >
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
        isChecked ? 'ring-primary' : 'ring-border-strong',
      )}
    >
      {isChecked ? <span className="size-2 rounded-full bg-primary" /> : null}
    </span>
    <span
      className={cn(
        'min-w-0 flex-1 truncate text-foreground',
        isMono ? 'font-mono text-code' : 'text-label',
      )}
    >
      {label}
    </span>
    <span className="shrink-0 truncate text-meta text-muted-foreground">{hint}</span>
  </button>
);
