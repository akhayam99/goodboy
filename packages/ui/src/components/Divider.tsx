import { cn } from '../cn';

export interface DividerProps {
  readonly className?: string;
  readonly orientation?: 'horizontal' | 'vertical';
}

/**
 * Hairline rule that fades out at both ends — softer than a hard border.
 * Shared by sidebar section breaks, dialog separators, and chat turn rules.
 */
export function Divider({ className, orientation = 'horizontal' }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        orientation === 'horizontal'
          ? 'h-px w-full bg-gradient-to-r from-transparent via-border-soft to-transparent'
          : 'w-px self-stretch bg-gradient-to-b from-transparent via-border-soft to-transparent',
        className,
      )}
    />
  );
}
