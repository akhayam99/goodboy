import type { AgentId } from '@goodboy/types';

const running = new Map<AgentId, Array<() => void>>();

type TrackParams = {
  readonly agentId: AgentId;
  readonly cancel: () => void;
};

export const trackDemoRun = ({ agentId, cancel }: TrackParams): void => {
  running.set(agentId, [...(running.get(agentId) ?? []), cancel]);
};

type StopParams = {
  readonly agentId: AgentId;
};

export const stopDemoRuns = ({ agentId }: StopParams): void => {
  for (const cancel of running.get(agentId) ?? []) {
    cancel();
  }
  running.delete(agentId);
};
