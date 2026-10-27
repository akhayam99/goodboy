import type { AgentId } from '@goodboy/types';
import type { OutputHandoff } from '../../../shared/utils/outputHandoff';
import type { OutputHandoffsState } from './state';

export type QueueOutputHandoffParams = {
  readonly agentId: AgentId;
  readonly handoff: OutputHandoff;
};

export type ConsumeOutputHandoffsParams = {
  readonly agentId: AgentId;
  readonly ids: ReadonlyArray<string>;
};

export type OutputHandoffsSlice = OutputHandoffsState & {
  queueOutputHandoff(params: QueueOutputHandoffParams): void;
  consumeOutputHandoffs(params: ConsumeOutputHandoffsParams): void;
};
