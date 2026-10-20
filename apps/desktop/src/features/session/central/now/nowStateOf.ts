import { NAMES } from '../../../../shared/names';
import type { ActionCardModel } from '../next/actionCardsOf';
import type { LiveGroupModel } from './liveGroupsOf';
import { needsYouCountOf } from './needsYouCountOf';

export type NowState = 'stuck' | 'waiting' | 'working' | 'done' | 'idle';

export const NOW_STATE_WORD: Record<NowState, string> = {
  stuck: 'Stuck',
  waiting: NAMES.needsYou,
  working: 'Working',
  done: 'Done',
  idle: 'Idle',
};

type Params = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly hasMergedRequest: boolean;
  readonly hasDoneWork: boolean;
};

export const nowStateOf = ({ groups, cards, hasMergedRequest, hasDoneWork }: Params): NowState => {
  if (groups.some((group) => group.state === 'stuck')) {
    return 'stuck';
  }
  if (needsYouCountOf({ cards }) > 0) {
    return 'waiting';
  }
  if (groups.some((group) => group.state === 'working' || group.state === 'deciding')) {
    return 'working';
  }
  if (groups.length > 0) {
    return 'waiting';
  }
  const isBlockedByCard = cards.some((card) => card.band === 0 || card.band === 1);
  if (!isBlockedByCard && (hasMergedRequest || hasDoneWork)) {
    return 'done';
  }
  return 'idle';
};
