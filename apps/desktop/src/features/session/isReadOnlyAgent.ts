import type { Agent } from '@goodboy/types';
import { classifyAgent, type AgentKind } from './agent-kind';

type Params = {
  readonly agent: Agent;
};

const READ_ONLY_KINDS: ReadonlyArray<AgentKind> = [
  'scout',
  'planner',
  'reviewer',
  'pr-reviewer',
  'report',
  'wireframe',
];

export const isReadOnlyAgent = ({ agent }: Params): boolean =>
  READ_ONLY_KINDS.includes(classifyAgent({ agent, override: null }));
