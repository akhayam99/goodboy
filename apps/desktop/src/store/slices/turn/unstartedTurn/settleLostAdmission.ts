import { createTranscriptOwnedTurnError } from '../../../../features/chat/turn-errors';
import type { TurnContext } from '../turnContext';
import type { GetFn, SetFn } from '../types';
import { closeUnspawnedRun } from './closeUnspawnedRun';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  ctx: TurnContext;
  err: unknown;
}>;

const LOST_MESSAGE =
  "Another window took this agent while the turn waited to start, so it didn't run. Send it again.";

export const settleLostAdmission = async ({ set, get, ctx, err }: Params): Promise<void> => {
  const { sessionId } = ctx.input;
  const { activeAgentId, resolvedAgentId, agentBefore, runId, now, progress } = ctx;
  await closeUnspawnedRun({
    set,
    get,
    sessionId,
    agentId: activeAgentId,
    resolvedAgentId,
    agentBefore,
    runId,
    error: err,
  });
  get().appendTurnEvent(activeAgentId, sessionId, {
    kind: 'error',
    runId,
    message: LOST_MESSAGE,
    retryable: false,
    at: now(),
  });
  progress.lastError = createTranscriptOwnedTurnError({ message: LOST_MESSAGE, cause: err });
};
