import { Button, cn } from '@goodboy/ui';

type Props = {
  readonly isPending: boolean;
  readonly error: string | null;
  readonly canRetry: boolean;
  readonly onRetry: () => void;
  readonly className?: string;
};

export const RenameStatus = ({ isPending, error, canRetry, onRetry, className }: Props) => {
  if (isPending) {
    return (
      <span role="status" className={cn('shrink-0 text-meta text-muted-foreground', className)}>
        Saving
      </span>
    );
  }
  if (error === null) {
    return null;
  }
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <span role="alert" className="min-w-0 truncate text-meta text-danger">
        {error}
      </span>
      {canRetry ? (
        <Button
          size="xs"
          variant="secondary"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </span>
  );
};
