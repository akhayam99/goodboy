import type { Agent } from '@goodboy/types';
import { isLiveCommentRun } from './isLiveCommentRun';

type Params = {
  readonly agent: Agent;
};

export const isRunningCommentRun = ({ agent }: Params): boolean =>
  isLiveCommentRun({ agent }) && agent.status !== 'completed' && agent.status !== 'skipped';
