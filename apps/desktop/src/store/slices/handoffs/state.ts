import type { AgentHandoff } from '@goodboy/types';

export type HandoffsState = {
  readonly agentHandoffs: Readonly<Record<string, AgentHandoff | null>>;
};

export const handoffsInitialState: HandoffsState = {
  agentHandoffs: {},
};
