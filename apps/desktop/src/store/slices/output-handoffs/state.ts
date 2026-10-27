import type { AgentId } from '@goodboy/types';
import type { OutputHandoff } from '../../../shared/utils/outputHandoff';

export type OutputHandoffsState = {
  readonly outputHandoffs: Readonly<Record<AgentId, ReadonlyArray<OutputHandoff>>>;
};

export const outputHandoffsInitialState: OutputHandoffsState = {
  outputHandoffs: {},
};
