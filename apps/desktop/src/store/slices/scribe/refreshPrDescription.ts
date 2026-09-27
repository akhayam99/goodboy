import type { MountId, SessionId } from '@goodboy/types';
import { isUntouchedScribeBody } from './scribeSignature';
import type { GetFn } from './types';

type Input = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const refreshPrDescription = (get: GetFn) => {
  return async ({ sessionId, mountId }: Input): Promise<boolean> => {
    const pr = get().mountGithub[mountId]?.pr ?? null;
    if (pr === null || pr.state === 'merged' || pr.state === 'closed') {
      return false;
    }
    if (!isUntouchedScribeBody({ body: pr.body })) {
      return false;
    }
    await get().requestScribe({
      sessionId,
      mountId,
      task: { kind: 'pr-update', prNumber: pr.number },
    });
    return true;
  };
};
