import type { AgentKind } from './agent-kind';

const RUNS_ON_KINDS: ReadonlySet<AgentKind> = new Set([
  'implementer',
  'resolver',
  'reviewer',
  'pr-reviewer',
  'debugger',
]);

type Params = {
  readonly kind: AgentKind;
};

export const showsRunsOn = ({ kind }: Params): boolean => RUNS_ON_KINDS.has(kind);
