import type { RebaseStopRow } from '../../../history/rebaseStopRowOf';
import { OVERVIEW_CARD_OF_GROUP } from '../cards/overviewCardOfGroup';
import type { ActionCardModel } from './actionCardsOf';
import { nextGroupsOf } from './nextGroupsOf';
import { nextRowCopyOf, type NextBranchName } from './nextRowCopyOf';

type CardParams = {
  readonly card: ActionCardModel;
};

type StopParams = {
  readonly mountId: string | null;
};

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly seen: ReadonlyArray<string>;
  readonly branchFor: (params: CardParams) => NextBranchName | null;
  readonly stopRowFor: (params: StopParams) => Pick<RebaseStopRow, 'sentence'> | null;
};

export const nextLeadTitleOf = ({ cards, seen, branchFor, stopRowFor }: Params): string | null => {
  const group = nextGroupsOf({ cards, seen }).find(
    (candidate) => OVERVIEW_CARD_OF_GROUP[candidate.id] === 'branches',
  );
  const row = group?.rows[0];
  if (group === undefined || row === undefined) {
    return null;
  }
  return nextRowCopyOf({
    row,
    group: group.id,
    branch: branchFor({ card: row }),
    stopLine:
      row.kind === 'rebase' ? (stopRowFor({ mountId: row.mountId })?.sentence ?? null) : null,
  }).title;
};
