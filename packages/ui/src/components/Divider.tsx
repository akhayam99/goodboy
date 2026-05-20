import { cn } from '../cn';

export interface DividerProps {
  readonly className?: string;
}

/**
 * Hairline rule that fades out at both ends — softer than a hard border.
 * Shared by sidebar section breaks and chat turn separators.
 */
export function Divider({ className }: DividerProps) {
  return (
    <div
      role="separator"
      className={cn(
        'h-px w-full bg-gradient-to-r from-transparent via-border-soft to-transparent',
        className,
      )}
    />
  );
}
