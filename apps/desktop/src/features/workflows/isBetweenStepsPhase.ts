import type { OrchestratorPhase } from './orchestratorState';

type Params = {
  readonly phase: OrchestratorPhase;
};

export const isBetweenStepsPhase = ({ phase }: Params): boolean =>
  phase === 'deciding' || phase === 'automatic';
