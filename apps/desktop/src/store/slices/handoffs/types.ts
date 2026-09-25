import type { AgentHandoff, AgentId } from '@goodboy/types';
import type { HandoffsState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type LoadAgentHandoffParams = {
  readonly agentId: AgentId;
};

export type RecordAgentHandoffParams = {
  readonly handoff: AgentHandoff;
};

export type HandoffsSlice = HandoffsState & {
  loadAgentHandoff(params: LoadAgentHandoffParams): Promise<void>;
  recordAgentHandoff(params: RecordAgentHandoffParams): Promise<void>;
};
