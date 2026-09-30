import { selectMountById } from '../project-mounts/selectors';
import { mountContinuationPrompt, takeMountContinuation } from './mountContinuations';
import type { GetFn, SendTurnResult, SendTurnInput } from './types';

type Params = Readonly<{
  get: GetFn;
  run: (input: SendTurnInput) => Promise<SendTurnResult>;
  input: SendTurnInput;
}>;

export const continueOnRequestedMount = async ({ get, run, input }: Params) => {
  const continuation = takeMountContinuation({ sessionId: input.sessionId });
  if (continuation === null) {
    return;
  }
  const target = selectMountById({
    state: get(),
    sessionId: input.sessionId,
    mountId: continuation.mountId,
  });
  if (target === null) {
    return;
  }
  await get().setSessionActiveMount({
    sessionId: input.sessionId,
    mountId: continuation.mountId,
  });
  await run({
    sessionId: input.sessionId,
    ...(input.agentId !== undefined && { agentId: input.agentId }),
    content: mountContinuationPrompt({ continuation }),
    origin: 'mount-continuation',
  });
};
