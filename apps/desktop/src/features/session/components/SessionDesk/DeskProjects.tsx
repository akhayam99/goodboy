import { Button, ROW_HOVER, SectionLabel, StatusDot, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { branchPlace, sessionPlace, useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import { boardTileChipOf } from '../../central/board/boardTileChipOf';
import type { BranchBoardView } from '../ProjectBlocks/useBranchBoard';

type Props = {
  readonly sessionId: SessionId;
  readonly board: BranchBoardView;
};

export const DeskProjects = ({ sessionId, board }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const rows = board.board.rows;
  if (rows.length === 0) {
    return null;
  }
  return (
    <section
      aria-label={NAMES.projects}
      data-desk-section="projects"
      className="flex min-w-0 flex-col gap-1"
    >
      <span className="flex h-7 items-center">
        <SectionLabel label={NAMES.projects} headingLevel={2} />
      </span>
      {rows.map((row) => {
        const entry = board.entryByRowId.get(row.id) ?? null;
        const chip = boardTileChipOf({
          row,
          entry,
          runningCount: board.runningByRowId.get(row.id) ?? 0,
        });
        const name = row.projectName ?? row.branch ?? NAMES.notOnABranch;
        return (
          <Button
            key={row.id}
            variant="quiet"
            size="sm"
            data-desk-project={row.id}
            aria-label={chip === null ? name : `${name}, ${chip.word}`}
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
            <StatusDot tone={chip?.tone ?? 'neutral'} size="sm" />
            <span className="min-w-0 truncate text-row text-foreground">{name}</span>
            {row.branch === null || row.projectName === null ? null : (
              <span className="min-w-0 truncate text-meta text-faint-foreground">{row.branch}</span>
            )}
          </Button>
        );
      })}
    </section>
  );
};
