import { useState } from 'react';
import { EmptyState, ErrorStrip, FOCUS_RING, Skeleton, cn } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { PrFileDiffDialog } from './PrFileDiffDialog';

type Props = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
};

export const PrChanges = ({ files, isLoading, error, onRetry }: Props) => {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const openFile = files.find((file) => file.path === openPath) ?? null;

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

  return (
    <>
      <ul aria-label="Changed files" className="flex flex-col gap-px">
        {files.map((file) => (
          <li key={file.path}>
            <button
              type="button"
              onClick={() => setOpenPath(file.path)}
              className={cn(
                'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-2xs hover:bg-hover',
                FOCUS_RING,
              )}
            >
              <span className="min-w-0 flex-1 truncate font-mono text-foreground">{file.path}</span>
              <span className="shrink-0 font-mono tabular-nums text-success">
                +{file.additions}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-danger">−{file.deletions}</span>
            </button>
          </li>
        ))}
      </ul>
      {openFile != null ? (
        <PrFileDiffDialog file={openFile} onClose={() => setOpenPath(null)} />
      ) : null}
    </>
  );
};
