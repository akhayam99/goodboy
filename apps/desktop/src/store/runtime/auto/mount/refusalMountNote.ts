import type { MountNote } from '@goodboy/core/auto';
import type { SessionId } from '@goodboy/types';
import type { AutoPorts } from '../ports';

type Params = {
  readonly ports: AutoPorts;
  readonly sessionId: SessionId;
  readonly requested: string | null;
  readonly reason: string;
};

export const refusalMountNote = async ({
  ports,
  sessionId,
  requested,
  reason,
}: Params): Promise<MountNote | null> => {
  if (requested === null) {
    return null;
  }
  const outcome = await ports.mountProject({
    sessionId,
    name: requested,
    branch: null,
    reason,
    mode: 'ask',
  });
  if (outcome.kind !== 'ask') {
    return null;
  }
  return { project: outcome.name, branch: null, reason, state: 'ask' };
};
