import { cn } from '../cn';

export type ValueTokenProps = {
  readonly value: string;
  readonly title?: string;
  readonly className?: string;
};

export const ValueToken = ({ value, title, className }: ValueTokenProps) => (
  <span
    title={title ?? value}
    className={cn(
      'inline-block max-w-full min-w-0 truncate rounded-md bg-muted px-1 align-middle font-mono text-[0.92em] leading-[1.35] text-foreground/90',
      className,
    )}
  >
    {value}
  </span>
);
