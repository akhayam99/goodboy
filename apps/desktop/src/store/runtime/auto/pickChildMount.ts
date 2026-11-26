import {
  isAutoWriterRole,
  isUsableMount,
  pickAutoMount,
  type AutoDelegationRole,
  type LeadPermissionValue,
  type MountPickOutcome,
  type PickableMount,
} from '@goodboy/core/auto';
import type { SessionId } from '@goodboy/types';
import type { AutoPorts } from './ports';

const ASK_FIRST =
  'Adding a project asks the user first, so nothing was added. Ask for the project with a mount block, then delegate this work again.';

export type ChildMountPick =
  MountPickOutcome | Readonly<{ kind: 'restore_failed'; mount: PickableMount; error: string }>;

type GoneParams = {
  readonly requested: string | null;
  readonly mounts: ReadonlyArray<PickableMount>;
};

const goneMountOf = ({ requested, mounts }: GoneParams): PickableMount | null => {
  if (requested === null) {
    return null;
  }
  const wanted = requested.toLowerCase();
  const matches = mounts.filter(
    (mount) => mount.id === requested || (mount.mountName ?? '').toLowerCase() === wanted,
  );
  const [only] = matches;
  if (matches.length !== 1 || only === undefined || only.projectId === null) {
    return null;
  }
  return isUsableMount({ mount: only }) ? null : only;
};

type Params = {
  readonly canRestore: boolean;
  readonly ports: AutoPorts;
  readonly addProject: LeadPermissionValue<'addProject'>;
  readonly sessionId: SessionId;
  readonly role: AutoDelegationRole;
  readonly requested: string | null;
  readonly mounts: ReadonlyArray<PickableMount>;
  readonly primaryMountId: string | null;
  readonly task: string;
};

export const pickChildMount = async ({
  canRestore,
  ports,
  addProject,
  sessionId,
  role,
  requested,
  mounts,
  primaryMountId,
  task,
}: Params): Promise<ChildMountPick> => {
  const first = pickAutoMount({ role, requested, mounts, primaryMountId });
  const gone = canRestore && first.kind === 'refused' ? goneMountOf({ requested, mounts }) : null;
  if (gone !== null) {
    const restored = await ports.attachMount({ sessionId, mountId: gone.id });
    if (restored.kind === 'failed') {
      return { kind: 'restore_failed', mount: gone, error: restored.error };
    }
    const fresh = await ports.loadMounts({ sessionId });
    return pickAutoMount({ role, requested, mounts: fresh, primaryMountId });
  }
  if (first.kind === 'picked' || first.code !== 'mount_missing' || !isAutoWriterRole({ role })) {
    return first;
  }
  if (addProject === 'ask') {
    return { ...first, message: `${first.message} ${ASK_FIRST}` };
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
