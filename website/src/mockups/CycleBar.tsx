export const CycleBar = ({
  beat,
  ms,
  active,
  trackClass = 'bg-muted-foreground/15',
  fillClass = 'bg-primary/60',
}: {
  beat: number | string;
  ms: number;
  active: boolean;
  trackClass?: string;
  fillClass?: string;
}) => (
  <span
    aria-hidden
    className={`mt-1.5 block h-[2px] w-full overflow-hidden rounded-full ${trackClass}`}
  >
    {active && (
      <span
        key={String(beat)}
        className={`cycle-fill block h-full rounded-full ${fillClass}`}
        style={{ animationDuration: `${ms}ms` }}
      />
    )}
  </span>
);
