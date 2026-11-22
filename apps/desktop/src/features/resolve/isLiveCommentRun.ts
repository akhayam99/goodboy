import type { Agent } from '@goodboy/types';
import { holdsCommentThreads } from './holdsCommentThreads';

type Params = {
  readonly agent: Agent;
};

export const isLiveCommentRun = ({ agent }: Params): boolean =>
  agent.deletedAt == null &&
  holdsCommentThreads({ agent }) &&
  agent.status !== 'stopped' &&
  agent.status !== 'failed';
