import type { AgentId } from '@goodboy/types';
import type { ScribeWork } from './types';

export type ScribeState = {
  readonly scribeWork: Readonly<Record<string, ScribeWork>>;
  readonly scribeAgents: Readonly<Record<AgentId, string>>;
};

export const scribeInitialState: ScribeState = {
  scribeWork: {},
  scribeAgents: {},
};
