type Props = {
  elapsedMs: number;
  onRetry?: () => void;
};

export const BootSlowNotice = ({ elapsedMs, onRetry }: Props) => {
  return (
    <div className="flex flex-col items-center gap-1.5 text-2xs text-muted-foreground">
      <span>this is taking longer than usual</span>
      <span>{Math.floor(elapsedMs / 1_000)}s</span>
      {onRetry !== undefined ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-border-soft bg-background px-3 py-1.5 text-foreground motion-safe:transition-colors hover:bg-subtle"
        >
          retry
        </button>
      ) : null}
    </div>
  );
};
