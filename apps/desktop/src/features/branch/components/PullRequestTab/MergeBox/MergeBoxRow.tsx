import {
  ArrowUpToLine,
  ChevronRight,
  CircleDashed,
  CircleQuestionMark,
  CircleX,
  GitBranch,
  GitCompareArrows,
  Hourglass,
  MessageSquare,
  MessageSquareWarning,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { ICON_SIZE, SelectableRow, cn, tintClasses } from '@goodboy/ui';
import type { MergeBoxGlyph, MergeBoxRow as Row, MergeBoxTarget } from './mergeBox';

type Props = {
  readonly row: Row;
  readonly onOpen: (target: MergeBoxTarget) => void;
};

const GLYPH: Readonly<Record<MergeBoxGlyph, LucideIcon>> = {
  failing: CircleX,
  running: CircleDashed,
  unknown: CircleQuestionMark,
  changes: MessageSquareWarning,
  waiting: Hourglass,
  ask: UserPlus,
  comments: MessageSquare,
  conflicts: TriangleAlert,
  push: ArrowUpToLine,
  behind: GitBranch,
  rebasing: GitBranch,
  diverged: GitCompareArrows,
};

const TARGET_WORD: Readonly<Record<MergeBoxTarget, string>> = {
  pr: 'Pull request',
  comments: 'Comments',
  files: 'Changes',
  commits: 'Commits',
  checks: 'Checks',
  work: 'Work',
  reviewers: 'Ask for review',
};

const LAYOUT = 'flex min-h-9 w-full min-w-0 items-center gap-3 px-3';

export const MergeBoxRow = ({ row, onOpen }: Props) => {
  const Glyph = GLYPH[row.glyph];
  const content = (
    <>
      <Glyph
        size={ICON_SIZE.control}
        aria-hidden
        className={cn('shrink-0', tintClasses(row.tone).icon)}
      />
      <span className="min-w-0 shrink truncate text-ui text-foreground">{row.title}</span>
      <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">
        {row.detail ?? ''}
      </span>
    </>
  );
  const opens = row.opens;
  if (opens === null) {
    return (
      <div data-testid={`merge-row-${row.id}`} data-tone={row.tone} className={LAYOUT}>
        {content}
      </div>
    );
  }
  const word = TARGET_WORD[opens];
  return (
    <SelectableRow
      selected={false}
      testId={`merge-row-${row.id}`}
      ariaLabel={
        row.detail === null ? `${row.title}, ${word}` : `${row.title}, ${row.detail}, ${word}`
      }
      className={LAYOUT}
      onClick={() => onOpen(opens)}
    >
      {content}
      <span className="flex shrink-0 items-center gap-1 text-meta text-faint-foreground">
        {word}
        <ChevronRight size={ICON_SIZE.row} aria-hidden />
      </span>
    </SelectableRow>
  );
};
