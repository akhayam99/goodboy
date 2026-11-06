import type { ProviderRunId } from '@goodboy/types';
import { probeLiveRunIds } from '../../../features/chat/turn';
import type { AppStore } from '../../store';

export const NO_KEPT_RUNS: ReadonlySet<ProviderRunId> = new Set();

type Params = Readonly<{
  state: Pick<AppStore, 'agentTurnState'>;
}>;

export const endedWaitingRunsOf = async ({
  state,
}: Params): Promise<ReadonlySet<ProviderRunId>> => {
  const waiting = Object.values(state.agentTurnState).flatMap((turnState) =>
    turnState?.kind === 'blocked' ? [turnState.runId] : [],
  );
  if (waiting.length === 0) {
    return NO_KEPT_RUNS;
  }
  const live = await probeLiveRunIds();
  if (live === null) {
    return NO_KEPT_RUNS;
  }
  return new Set(waiting.filter((runId) => !live.has(runId)));
};
