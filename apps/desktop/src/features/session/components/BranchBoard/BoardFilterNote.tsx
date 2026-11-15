import { Button } from '@goodboy/ui';
import type { BoardFilter } from '../../central/board/visibleGroupsOf';

type Props = {
  readonly filter: BoardFilter;
  readonly isEmpty: boolean;
  readonly onClear: () => void;
};

const FILTER_WORDS: Readonly<
  Record<BoardFilter, { readonly some: string; readonly none: string }>
> = {
  questions: {
    some: 'Showing the branches with open questions',
    none: 'No branch has an open question',
  },
};

export const BoardFilterNote = ({ filter, isEmpty, onClear }: Props) => (
  <p
    data-board-filter={filter}
    data-board-filter-empty={isEmpty}
    className="flex items-center gap-2 px-2 text-meta text-muted-foreground"
  >
    <span>{isEmpty ? FILTER_WORDS[filter].none : FILTER_WORDS[filter].some}</span>
    <Button size="sm" variant="quiet" onClick={onClear}>
      Clear
    </Button>
  </p>
);
