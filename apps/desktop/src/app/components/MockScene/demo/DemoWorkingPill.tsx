import { FLOATING_SURFACE, cn } from '@goodboy/ui';

type Props = {
  readonly copy: string;
};

export const DemoWorkingPill = ({ copy }: Props) => (
  <div
    role="status"
    data-testid="demo-working-pill"
    className={cn(
      'pointer-events-none absolute bottom-4 left-4 z-20 flex max-w-xs items-center gap-2 py-2 pl-3 pr-4 motion-safe:animate-fade-in',
      FLOATING_SURFACE,
    )}
  >
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full bg-info motion-safe:animate-soft-pulse"
    />
    <span className="min-w-0 truncate text-row text-foreground">{copy}</span>
  </div>
);
