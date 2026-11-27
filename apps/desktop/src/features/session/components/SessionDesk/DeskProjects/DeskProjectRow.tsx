import { Button, ROW_HOVER, StatusDot, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { branchPlace, sessionPlace, useAppStore } from '../../../../../store';
import { NAMES } from '../../../../../shared/utils/names';
import type { BoardRow } from '../../../central/board/boardTypes';
import type { ActionCardModel } from '../../../central/next/actionCardsOf';
import type { BranchEntry } from '../../../central/branches/branchStoryOf';
import { useBranchRow } from '../../ProjectBlocks/useBranchRow';

const NO_CARDS: ReadonlyArray<Pick<ActionCardModel, 'kind'>> = [];

const NO_ASKS: ReadonlySet<string> = new Set();

type Props = {
  readonly sessionId: SessionId;
  readonly row: BoardRow;
  readonly entry: BranchEntry | null;
  readonly runningCount: number;
};

export const DeskProjectRow = ({ sessionId, row, entry, runningCount }: Props) => {
  const navigate = useAppStore((store) => store.navigate);
  const branchRow = useBranchRow({
    sessionId,
    row,
    entry,
    runningCount,
    cards: NO_CARDS,
    shownAskIds: NO_ASKS,
    isPermissionShown: false,
  });
  const state = branchRow === null ? null : branchRow.word;
  const settled = row.isSettled ? state : null;
  const name = row.projectName ?? row.branch ?? NAMES.notOnABranch;
  return (
    <Button
      variant="quiet"
      size="sm"
      data-desk-project={row.id}
      aria-label={state === null ? name : `${name}, ${state.word}`}
      onClick={() =>
        navigate({
          to:
            entry === null
              ? sessionPlace({ sessionId, lens: 'workflows' })
              : branchPlace({ sessionId, mountPath: entry.fact.mountPath, tab: 'pr' }),
        })
      }
      className={cn('w-full justify-start gap-2 px-2 font-normal', ROW_HOVER)}
    >
      <StatusDot tone={state?.tone ?? 'neutral'} size="sm" />
      <span className="min-w-0 truncate text-row text-foreground">{name}</span>
      {row.branch === null || row.projectName === null ? null : (
        <span className="min-w-0 truncate text-meta text-faint-foreground">{row.branch}</span>
      )}
      {settled === null ? null : (
        <span data-desk-settled="" className="shrink-0 text-meta text-muted-foreground">
          {settled.word}
        </span>
      )}
    </Button>
  );
};
