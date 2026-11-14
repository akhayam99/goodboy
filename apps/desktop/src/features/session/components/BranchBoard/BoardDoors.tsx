import { GitCommitVertical, GitPullRequest, Globe, Plus, SquareTerminal } from 'lucide-react';
import { Button, ICON_SIZE, Tooltip } from '@goodboy/ui';
import { branchPlace, useAppStore } from '../../../../store';
import { useIsWorkOn } from '../../../../shared/hooks/useIsWorkOn';
import { openStartWork } from '../../../work/openStartWork';
import type { BranchWorkCounts } from '../../../branch/branchTabFactsOf';
import { countWordOf } from '../../central/board/countWordOf';
import { BoardRemoveButton } from './BoardRemoveButton';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
  readonly counts: BranchWorkCounts | null;
};

const TOOL_PENDING = 'Opens in the Tools rail once it lands.';

type CountsParams = {
  readonly counts: BranchWorkCounts | null;
};

const countsLineOf = ({ counts }: CountsParams): string =>
  counts === null
    ? ''
    : [
        { count: counts.runs, noun: 'run' },
        { count: counts.questions, noun: 'question' },
        { count: counts.artifacts, noun: 'artifact' },
      ]
        .filter((part) => part.count > 0)
        .map((part) => countWordOf(part))
        .join(' · ');

export const BoardDoors = ({ rowId, counts }: Props) => {
  const { session, rowById, entryByRowId, diffStatByPath } = useBoardContext();
  const navigate = useAppStore((state) => state.navigate);
  const isWork = useIsWorkOn();
  const row = rowById.get(rowId);
  const entry = entryByRowId.get(rowId) ?? null;
  if (row === undefined || entry === null) {
    return null;
  }
  const { fact } = entry;
  const stat = fact.mountPath === null ? undefined : diffStatByPath.get(fact.mountPath);
  const countsLine = countsLineOf({ counts });
  return (
    <div data-board-doors="" className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          navigate({
            to: branchPlace({ sessionId: session.id, mountPath: fact.mountPath, tab: 'files' }),
          })
        }
      >
        <GitCommitVertical size={ICON_SIZE.control} aria-hidden />
        Changes
        {stat === undefined || stat.files === 0 ? null : (
          <span className="flex items-center gap-1 tabular-nums text-faint-foreground">
            {stat.files}
            <span>
              <span className="text-success">+{stat.additions}</span>{' '}
              <span className="text-danger">-{stat.deletions}</span>
            </span>
          </span>
        )}
      </Button>
      <Tooltip content={TOOL_PENDING}>
        <span className="flex">
          <Button size="sm" variant="secondary" disabled>
            <SquareTerminal size={ICON_SIZE.control} aria-hidden />
            Terminal here
          </Button>
        </span>
      </Tooltip>
      <Tooltip content={TOOL_PENDING}>
        <span className="flex">
          <Button size="sm" variant="secondary" disabled>
            <Globe size={ICON_SIZE.control} aria-hidden />
            Browser here
          </Button>
        </span>
      </Tooltip>
      {fact.request === null ? null : (
        <Button
          size="sm"
          variant="quiet"
          onClick={() =>
            navigate({
              to: branchPlace({ sessionId: session.id, mountPath: fact.mountPath, tab: 'pr' }),
            })
          }
        >
          <GitPullRequest size={ICON_SIZE.control} aria-hidden />
          Open the PR page
        </Button>
      )}
      {isWork && !row.isMerged ? (
        <Button
          size="sm"
          variant="quiet"
          onClick={() =>
            openStartWork({
              seed: { sessionId: session.id, projectId: null, branch: row.branch, text: '' },
            })
          }
        >
          <Plus size={ICON_SIZE.control} aria-hidden />
          Start work on this branch
        </Button>
      ) : null}
      {row.isMerged ? <BoardRemoveButton mountIds={[fact.mountId]} variant="quiet" /> : null}
      {countsLine === '' ? null : (
        <span
          data-board-work-counts=""
          className="min-w-0 truncate text-meta text-faint-foreground"
        >
          {countsLine}
        </span>
      )}
    </div>
  );
};
