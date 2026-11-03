import type { SessionStageInfo } from '@goodboy/types';
import { sessionNodeOf } from '../../../features/session/sessionNode';

export type RailRank = 'needs' | 'running' | 'unread' | 'quiet';

type Params = {
  readonly info: SessionStageInfo;
};

export const railRankOf = ({ info }: Params): RailRank => {
  const isUnreadOnly = info.attention === 'unread-reply';
  if (info.stage === 'attention' && !isUnreadOnly) {
    return 'needs';
  }
  if (info.stage === 'running') {
    return 'running';
  }
  return sessionNodeOf({ info, isArchived: false }).hasUnread ? 'unread' : 'quiet';
};
