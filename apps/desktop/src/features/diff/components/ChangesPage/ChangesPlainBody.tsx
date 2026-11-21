import { Button, EmptyLine, ErrorStrip } from '@goodboy/ui';
import type { SessionDiff } from '../../hooks/useSessionDiff';
import { AllFilesEmpty } from './AllFilesEmpty';
import { DiffEmptyState } from './DiffEmptyState';
import { DiffLoadingBody } from './DiffLoadingBody';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly diff: SessionDiff;
  readonly baseBranch: string | null;
  readonly isAll: boolean;
  readonly onShowAllFiles: () => void;
  readonly onClearFilters: () => void;
};

export const ChangesPlainBody = ({
  diff,
  baseBranch,
  isAll,
  onShowAllFiles,
  onClearFilters,
}: Props) => {
  if (diff.loading) {
    return <DiffLoadingBody />;
  }
  if (diff.error !== null) {
    return (
      <div className="pl-4 pr-6">
        <ErrorStrip labels={['the diff']} error={new Error(diff.error)} onRetry={diff.refresh} />
      </div>
    );
  }
  if (diff.files.length > 0) {
    return (
      <div className="pl-4 pr-6">
        <EmptyLine
          action={
            <Button size="xs" variant="ghost" onClick={onClearFilters}>
              {NAMES.clearFilter}
            </Button>
          }
        >
          No files match.
        </EmptyLine>
      </div>
    );
  }
  if (isAll) {
    return <AllFilesEmpty baseBranch={baseBranch} />;
  }
  return (
    <DiffEmptyState
      view={diff.view}
      baseBranch={baseBranch}
      alternate={diff.alternate}
      onChange={diff.setView}
      onShowAllFiles={onShowAllFiles}
    />
  );
};
