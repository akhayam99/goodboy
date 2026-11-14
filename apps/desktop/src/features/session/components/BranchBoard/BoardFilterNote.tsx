import { Button } from '@goodboy/ui';
import type { BoardFilter } from '../../central/board/visibleGroupsOf';

type Props = {
  readonly filter: BoardFilter;
  readonly onClear: () => void;
};

const FILTER_LABEL: Readonly<Record<BoardFilter, string>> = {
  'needs-you': 'Needs you',
  checks: 'Checks',
};

export const BoardFilterNote = ({ filter, onClear }: Props) => (
  <p
    data-board-filter={filter}
    className="flex items-center gap-2 px-2 text-meta text-muted-foreground"
  >
    <span>Showing the branches behind &quot;{FILTER_LABEL[filter]}&quot;</span>
    <Button size="sm" variant="quiet" onClick={onClear}>
      Clear
    </Button>
  </p>
);
