import type { Agent } from '@goodboy/types';

type Params = Readonly<{
  agent: Pick<Agent, 'status'> | undefined;
}>;

export const isQueueParked = ({ agent }: Params): boolean =>
  agent?.status === 'stopped' || agent?.status === 'skipped';
