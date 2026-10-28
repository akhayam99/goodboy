import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { shortShaOf } from '../../rowFix';
import { ROW_FIX_COPY } from '../../rowFixCopy';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly commit: string;
};

export const RowFixDiffLink = ({ sessionId, entry, commit }: Props) => {
  const navigate = useAppStore((s) => s.navigate);
  const fallbackMountPath = useAppStore((s) => s.diffMountPath[sessionId] ?? null);
  const mountPath = entry.row.attempt?.mountTarget?.worktreePath ?? fallbackMountPath;
  return (
    <span className="absolute bottom-1 right-2">
      <Button
        size="sm"
        variant="ghost"
        data-row-fix-diff=""
        aria-label={`${ROW_FIX_COPY.seeDiffOf} ${shortShaOf({ sha: commit })}`}
        onClick={() =>
          navigate({
            to: branchPlace({
              sessionId,
              mountPath,
              tab: 'files',
              focus: { kind: 'commit', sha: commit, path: null },
            }),
          })
        }
      >
        {ROW_FIX_COPY.seeDiff}
      </Button>
    </span>
  );
};
