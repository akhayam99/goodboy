import type { ReactNode } from 'react';
import { ListGrid, ListGridGroup, SearchField } from '@goodboy/ui';
import { QUESTIONS_GRID_COLUMNS } from './questionsGridColumns';

type Props = {
  readonly count: number;
  readonly isShown: boolean;
  readonly search: string;
  readonly onToggle: () => void;
  readonly onSearch: (next: string) => void;
  readonly rows: ReactNode;
  readonly branches: ReactNode;
};

export const QuestionsAnswered = ({
  count,
  isShown,
  search,
  onToggle,
  onSearch,
  rows,
  branches,
}: Props) => (
  <ListGrid label="Answered questions" columns={QUESTIONS_GRID_COLUMNS} isGrouped>
    <ListGridGroup
      headingLevel={2}
      label="Answered"
      count={count}
      fold={{ label: isShown ? 'Hide' : 'Show', onToggle }}
      lead={
        isShown ? (
          <li className="col-span-full grid grid-cols-subgrid">
            <div className="col-start-2 col-end-[-1] min-w-0">
              <SearchField
                ariaLabel="Search answered questions"
                placeholder="Search answered"
                value={search}
                onChange={onSearch}
              />
            </div>
          </li>
        ) : undefined
      }
    >
      {isShown ? rows : null}
    </ListGridGroup>
    {isShown ? branches : null}
  </ListGrid>
);
