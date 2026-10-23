import {
  isAutoWriterRole,
  pickAutoMount,
  type AutoDelegationRole,
  type MountPickOutcome,
  type PickableMount,
} from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import type { AutoPorts } from './ports';

type Params = {
  readonly ports: AutoPorts;
  readonly sessionId: SessionId;
  readonly role: AutoDelegationRole;
  readonly requested: string | null;
  readonly mounts: ReadonlyArray<PickableMount>;
  readonly primaryMountId: string | null;
  readonly task: string;
};

export const pickChildMount = async ({
  ports,
  sessionId,
  role,
  requested,
  mounts,
  primaryMountId,
  task,
}: Params): Promise<MountPickOutcome> => {
  const first = pickAutoMount({ role, requested, mounts, primaryMountId });
  if (first.kind === 'picked' || first.code !== 'mount_missing' || !isAutoWriterRole({ role })) {
    return first;
  }
  const added = await ports.mountTaskFolders({ sessionId, requested, text: task });
  if (added.mounted.length > 0) {
    const fresh = await ports.loadMounts({ sessionId });
    return pickAutoMount({ role, requested, mounts: fresh, primaryMountId });
  }
  const notes = [
    ...(added.asked.length === 0
      ? []
      : [
          `Asked the user to add ${added.asked.join(', ')} to this conversation. Wait for that answer before you delegate this work again.`,
        ]),
    ...(added.failed.length === 0 ? [] : [`Could not add: ${added.failed.join('; ')}.`]),
  ];
  return notes.length === 0 ? first : { ...first, message: `${first.message} ${notes.join(' ')}` };
};
