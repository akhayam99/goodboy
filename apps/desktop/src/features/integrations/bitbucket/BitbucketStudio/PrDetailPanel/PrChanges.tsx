import { EmptyState, ErrorStrip, Skeleton } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { DiffView } from '../../../../diff/components/DiffView';

type Props = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
};

export const PrChanges = ({ files, isLoading, error, onRetry }: Props) => {
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading the diff" className="flex flex-col gap-1.5">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-4 w-full rounded-sm" />
        ))}
      </div>
    );
  }

  if (error != null) {
    return <ErrorStrip label="the diff" error={new Error(error)} onRetry={onRetry} />;
  }

  if (files.length === 0) {
    return (
      <EmptyState
        icon={CONCEPT_ICONS.diff}
        tone={CONCEPT_TONE.diff}
        title="No file changes"
        description="This pull request does not touch any file Goodboy can render."
        size="inline"
      />
    );
  }

  return <DiffView files={files} presentation="inline" />;
};
