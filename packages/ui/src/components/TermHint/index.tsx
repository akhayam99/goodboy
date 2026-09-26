import type { FocusEvent, ReactNode } from 'react';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';
import { useDropdown } from '../../useDropdown';
import { AnchoredPopover } from '../AnchoredPopover';

export type TermHintAction = {
  readonly label: string;
  readonly onAct: () => void;
};

export type TermHintProps = {
  readonly children: ReactNode;
  readonly term: string;
  readonly definition: string;
  readonly action?: TermHintAction;
  readonly className?: string;
};

const isKeyboardFocus = ({ target }: { readonly target: Element }): boolean => {
  try {
    return target.matches(':focus-visible');
  } catch {
    return false;
  }
};

export const TermHint = ({ children, term, definition, action, className }: TermHintProps) => {
  const dropdown = useDropdown({ width: 'w-72', expectedHeight: 120, expectedWidth: 288 });

  const onFocus = (event: FocusEvent<HTMLButtonElement>) => {
    if (dropdown.open || !isKeyboardFocus({ target: event.currentTarget })) {
      return;
    }
    dropdown.toggle();
  };

  const onBlur = (event: FocusEvent<HTMLButtonElement>) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || dropdown.popupRef.current?.contains(next) === true) {
      return;
    }
    dropdown.close();
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={term}
      anchorClassName="inline-block"
      className="flex flex-col gap-1 p-3"
      trigger={
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          onClick={() => dropdown.toggle()}
          onFocus={onFocus}
          onBlur={onBlur}
          className={cn(
            'cursor-help rounded-xs text-inherit underline decoration-current/60 decoration-dotted underline-offset-2',
            'motion-safe:transition-colors hover:decoration-current',
            FOCUS_RING,
            className,
          )}
        >
          {children}
        </button>
      }
    >
      <span className="text-label font-medium text-foreground">{term}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{definition}</span>
      {action === undefined ? null : (
        <button
          type="button"
          onClick={() => {
            dropdown.close();
            action.onAct();
          }}
          className={cn(
            'self-start rounded-xs text-label text-primary hover:underline',
            FOCUS_RING,
          )}
        >
          {action.label}
        </button>
      )}
    </AnchoredPopover>
  );
};
