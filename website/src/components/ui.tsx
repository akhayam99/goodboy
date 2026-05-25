/* Marketing-side primitives. Same visual grammar as packages/ui in the desktop
   app: semantic tokens only, no raw hex, no decorative chrome. If a component
   here grows ::before glow rings or animated borders, it has broken the rule.
*/

import type { AnchorHTMLAttributes, ReactNode } from 'react';

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ----------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'md' | 'lg';

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-[oklch(0.78_0.11_200)] active:bg-[oklch(0.70_0.11_200)]',
  secondary: 'border border-border bg-subtle text-foreground hover:bg-muted',
  ghost: 'text-muted-foreground hover:text-foreground',
};

const sizeClass: Record<ButtonSize, string> = {
  md: 'h-9 px-4 text-sm rounded-md',
  lg: 'h-11 px-5 text-[15px] rounded-md',
};

const baseClass =
  'inline-flex items-center justify-center gap-1.5 font-medium tracking-[-0.005em] transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <a className={cn(baseClass, variantClass[variant], sizeClass[size], className)} {...rest} />
  );
}

/* ----------------------------- Eyebrow -------------------------------- */

/* Small uppercase eyebrow above section titles. Tracking matches the
   desktop's section labels (compact, 0.10em). No accent color by default. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ----------------------------- SectionTitle --------------------------- */

/* Standard editorial title. One color, careful tracking, line-height that
   pairs with the body. No gradients. */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        'mt-4 text-3xl sm:text-4xl tracking-[-0.025em] leading-[1.05] font-semibold text-foreground',
        className,
      )}
    >
      {children}
    </h2>
  );
}
