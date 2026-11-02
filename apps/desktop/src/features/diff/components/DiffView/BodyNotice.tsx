import { Button, Skeleton } from '@goodboy/ui';
import type { DiffBodyTarget } from './types';

type Props = {
  readonly state: 'pending' | 'failed';
  readonly path: string;
  readonly onRetry: ((target: DiffBodyTarget) => void) | null;
};

export const BodyNotice = ({ state, path, onRetry }: Props) => {
  if (state === 'pending') {
    return (
      <div role="status" aria-label="Loading diff" data-slot="diff-file-pending" className="h-24">
        <Skeleton className="size-full rounded-md" />
      </div>
    );
  }
  return (
    <div
      data-slot="diff-file-failed"
      className="flex h-24 items-center justify-center gap-2 text-meta text-muted-foreground"
    >
      <span>Couldn't load this diff.</span>
      {onRetry === null ? null : (
        <Button variant="ghost" size="sm" onClick={() => onRetry({ path })}>
          Retry
        </Button>
      )}
    </div>
  );
};
