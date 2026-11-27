import { Button, ROW_HOVER, SectionLabel, StatusDot, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { branchPlace, sessionPlace, useAppStore } from '../../../../../store';
import { NAMES } from '../../../../../shared/utils/names';
import type { ActionCardModel } from '../../../central/next/actionCardsOf';
import { branchRowOf } from '../../../central/board/branchRowOf';
import type { BranchBoardView } from '../../ProjectBlocks/useBranchBoard';

const NO_CARDS: ReadonlyArray<Pick<ActionCardModel, 'kind'>> = [];

const NO_ASKS: ReadonlySet<string> = new Set();

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
        const branchRow = branchRowOf({
          row,
          entry,
          runningCount: board.runningByRowId.get(row.id) ?? 0,
          cards: NO_CARDS,
          shownAskIds: NO_ASKS,
          isPermissionShown: false,
          failingCheckName: null,
          overlap: null,
        });
        const state = branchRow.word;
        const settled = row.isSettled ? state : null;
        const name = row.projectName ?? row.branch ?? NAMES.notOnABranch;
        return (
          <Button
            key={row.id}
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
      })}
    </section>
  );
};
