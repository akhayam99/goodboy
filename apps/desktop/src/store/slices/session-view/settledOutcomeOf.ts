import type { Agent, SessionArtifact } from '@goodboy/types';
import { isReadOnlyAgent } from '../../../features/session/isReadOnlyAgent';

export type SettledOutcome = 'answered' | 'finished' | 'report-ready' | 'plan-ready';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly isBranchless: boolean;
};

type AgentParams = {
  readonly agent: Agent;
};

const FINISHED_STATUSES: ReadonlyArray<Agent['status']> = ['completed', 'skipped'];

const isFinished = ({ agent }: AgentParams): boolean => FINISHED_STATUSES.includes(agent.status);

export const settledOutcomeOf = ({
  agents,
  artifacts,
  isBranchless,
}: Params): SettledOutcome | null => {
  const own = agents.filter((agent) => agent.deletedAt == null);
  if (own.length === 0 || !own.every((agent) => isFinished({ agent }))) {
    return null;
  }
  if (!isBranchless && !own.every((agent) => isReadOnlyAgent({ agent }))) {
    return null;
  }
  const live = artifacts.filter(
    (artifact) => artifact.status === 'active' || artifact.status === 'consumed',
  );
  if (live.some((artifact) => artifact.kind === 'plan')) {
    return 'plan-ready';
  }
  if (live.some((artifact) => artifact.kind === 'report' || artifact.kind === 'wireframe')) {
    return 'report-ready';
  }
  return own.every((agent) => isReadOnlyAgent({ agent })) ? 'answered' : 'finished';
};
