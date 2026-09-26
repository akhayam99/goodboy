import type { HistoryRunPhase } from './types';

const ACTIVE_PHASES: ReadonlySet<HistoryRunPhase> = new Set<HistoryRunPhase>([
  'predicting',
  'trying',
  'waiting',
  'applying',
  'pushing',
  'rewriting',
]);

type Params = {
  readonly phase: HistoryRunPhase;
};

export const isHistoryRunActive = ({ phase }: Params): boolean => ACTIVE_PHASES.has(phase);
