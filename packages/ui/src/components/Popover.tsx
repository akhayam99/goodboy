import type { CSSProperties, ReactNode, Ref } from 'react';
import { cn } from '../cn';

export interface Props {
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly role?: 'menu' | 'dialog' | 'listbox';
  readonly ariaLabel?: string;
  readonly innerRef?: Ref<HTMLDivElement>;
}

/**
 * Canonical popover surface: the floating card shared by every dropdown,
 * picker, and menu in the app. Centralizes the visual contract (background,
 * border, shadow, radius, base typography) so every popover reads the same.
 *
 * Positioning is the caller's responsibility, pass `style` for fixed/portal
 * placement or compose with absolute classes via `className`.
 */
export function Popover({ children, className, style, role, ariaLabel, innerRef }: Props) {
  return (
    <div
      ref={innerRef}
      role={role}
      aria-label={ariaLabel}
      style={style}
      className={cn(
        'overflow-hidden rounded-md border border-border bg-muted text-xs shadow-lg',
        className,
      )}
    >
      {children}
    </div>
  );
}
