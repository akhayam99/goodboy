import type { Agent } from '@goodboy/types';

type Params = {
  readonly agent: Agent;
};

export const isLiveCommentRun = ({ agent }: Params): boolean =>
  agent.deletedAt == null &&
  agent.sourceKind === 'comment_run' &&
  agent.status !== 'stopped' &&
  agent.status !== 'failed';
