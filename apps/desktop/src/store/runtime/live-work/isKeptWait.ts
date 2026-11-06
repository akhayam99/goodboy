import type { ProviderRunId, TurnState } from '@goodboy/types';

type Params = Readonly<{
  turnState: TurnState | undefined;
  keptRuns: ReadonlySet<ProviderRunId>;
}>;

export const isKeptWait = ({ turnState, keptRuns }: Params): boolean =>
  turnState?.kind === 'blocked' && keptRuns.has(turnState.runId);
