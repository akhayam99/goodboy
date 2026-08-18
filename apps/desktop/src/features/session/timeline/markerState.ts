import type { Agent } from '@goodboy/types';

export type TimelineMarkerState =
  'done' | 'failed' | 'running' | 'pending' | 'skipped' | 'needsUser' | 'question';

type Params = {
  readonly status: Agent['status'];
  readonly hasOpenQuestion: boolean;
  readonly needsUser: boolean;
};

export const resolveMarkerState = ({
  status,
  hasOpenQuestion,
  needsUser,
}: Params): TimelineMarkerState => {
  if (hasOpenQuestion) {
    return 'question';
  }
  if (status === 'running') {
    return 'running';
  }
  if (needsUser) {
    return 'needsUser';
  }
  switch (status) {
    case 'completed':
      return 'done';
    case 'failed':
      return 'failed';
    case 'pending':
      return 'pending';
    case 'skipped':
      return 'skipped';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
};
