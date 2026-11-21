import { ErrorStrip, Skeleton } from '@goodboy/ui';
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
    <div data-slot="diff-file-failed" className="px-3 py-2">
      <ErrorStrip
        labels={['this diff']}
        error={new Error('')}
        {...(onRetry === null ? {} : { onRetry: () => onRetry({ path }) })}
      />
    </div>
  );
};
