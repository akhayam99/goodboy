import { createContext } from 'react';
import type { Session } from '@goodboy/types';
import type { MountDiffStat } from '../../../../store';
import type { BranchEntry } from '../../central/branches/branchStoryOf';
import type { BoardRow } from '../../central/board/boardTypes';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import type { RemoveWorktrees } from './useRemoveWorktrees';

type ToggleParams = {
  readonly rowId: string;
};

export type BoardContextValue = Readonly<{
  session: Session;
  now: number;
  isNarrow: boolean;
  rowById: ReadonlyMap<string, BoardRow>;
  entryByRowId: ReadonlyMap<string, BranchEntry>;
  runningByRowId: ReadonlyMap<string, number>;
  mergedAtByMountId: ReadonlyMap<string, number>;
  newRowIds: ReadonlySet<string>;
  diffStatByPath: ReadonlyMap<string, MountDiffStat>;
  cardsByRowId: ReadonlyMap<string, ReadonlyArray<ActionCardModel>>;
  mergeCard: ActionCardModel | null;
  actionsFor: ActionCardActions['actionsFor'];
  openFor: ActionCardActions['openFor'];
  removal: RemoveWorktrees;
  openIds: ReadonlySet<string>;
  onToggleRow: (params: ToggleParams) => void;
}>;

export const BoardContext = createContext<BoardContextValue | null>(null);
