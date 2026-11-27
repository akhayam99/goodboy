import { SectionLabel } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { NAMES } from '../../../../../shared/utils/names';
import type { BranchBoardView } from '../../ProjectBlocks/useBranchBoard';
import { DeskProjectRow } from './DeskProjectRow';

type Props = {
  readonly sessionId: SessionId;
  readonly board: BranchBoardView;
};

export const DeskProjects = ({ sessionId, board }: Props) => {
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
      {rows.map((row) => (
        <DeskProjectRow
          key={row.id}
          sessionId={sessionId}
          row={row}
          entry={board.entryByRowId.get(row.id) ?? null}
          runningCount={board.runningByRowId.get(row.id) ?? 0}
        />
      ))}
    </section>
  );
};
