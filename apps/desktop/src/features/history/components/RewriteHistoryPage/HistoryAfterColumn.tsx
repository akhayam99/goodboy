import { Eyebrow } from '@goodboy/ui';
import type { HistoryRowMark } from '../../historyRowMarks';
import type { RowPositions } from '../../useRowPositions';
import { HistoryAfterGraph } from './HistoryAfterGraph';

type Props = {
  readonly afterCount: number;
  readonly keep: ReadonlyArray<string>;
  readonly marks: ReadonlyMap<string, HistoryRowMark>;
  readonly positions: RowPositions;
  readonly isOnMain: boolean;
  readonly highlighted: ReadonlySet<string>;
  readonly workingSha: string | null;
  readonly titleOf: (sha: string) => string;
  readonly onHover: (sha: string | null) => void;
};

export const HistoryAfterColumn = ({
  afterCount,
  keep,
  marks,
  positions,
  isOnMain,
  highlighted,
  workingSha,
  titleOf,
  onHover,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-2 self-stretch rounded-lg bg-subtle pb-2 pl-2 pr-3">
    <div className="flex h-6 items-center gap-2 pl-2">
      <Eyebrow label="After Apply" muted />
      <span className="text-label text-faint-foreground">
        {afterCount} {afterCount === 1 ? 'commit' : 'commits'}
      </span>
    </div>
    <HistoryAfterGraph
      keep={keep}
      marks={marks}
      positions={positions}
      isOnMain={isOnMain}
      highlighted={highlighted}
      workingSha={workingSha}
      titleOf={(sha) => marks.get(sha)?.renamedTo ?? titleOf(sha)}
      onHover={onHover}
    />
  </div>
);
