import { isAutoWriterRole, type AutoDelegationRole } from './roles';

export type PickableMount = Readonly<{
  id: string;
  mountName: string | null;
  branch: string;
  projectId: string | null;
  worktreePath: string | null;
  revision: number;
  isAttached: boolean;
  diskState: string;
}>;

export type PickMountParams = Readonly<{
  role: AutoDelegationRole;
  requested: string | null;
  mounts: ReadonlyArray<PickableMount>;
  primaryMountId: string | null;
}>;

export type MountPickRefusalCode = 'mount_missing' | 'mount_ambiguous';

export type MountPickOutcome =
  | Readonly<{ kind: 'picked'; mount: PickableMount; source: 'named' | 'primary' }>
  | Readonly<{
      kind: 'refused';
      code: MountPickRefusalCode;
      message: string;
      allowed: ReadonlyArray<PickableMount>;
    }>;

type UsableParams = {
  readonly mount: PickableMount;
};

export const isUsableMount = ({ mount }: UsableParams): boolean =>
  mount.isAttached &&
  mount.worktreePath !== null &&
  (mount.diskState === 'present' || mount.diskState === 'unchecked');

type DescribeParams = {
  readonly mounts: ReadonlyArray<PickableMount>;
};

export const describeMounts = ({ mounts }: DescribeParams): string =>
  mounts.length === 0
    ? 'This conversation has no mount you can use.'
    : `Mounts you can name: ${mounts
        .map((mount) => `${mount.id} (${mount.mountName ?? 'unnamed'}, branch ${mount.branch})`)
        .join('; ')}.`;

type RefuseParams = {
  readonly code: MountPickRefusalCode;
  readonly message: string;
  readonly mounts: ReadonlyArray<PickableMount>;
};

const refuse = ({ code, message, mounts }: RefuseParams): MountPickOutcome => {
  const allowed = mounts.filter((mount) => isUsableMount({ mount }));
  return {
    kind: 'refused',
    code,
    message: `${message} ${describeMounts({ mounts: allowed })}`,
    allowed,
  };
};

type NamedParams = {
  readonly requested: string;
  readonly mounts: ReadonlyArray<PickableMount>;
};

const namedMatches = ({ requested, mounts }: NamedParams): ReadonlyArray<PickableMount> => {
  const byId = mounts.filter((mount) => mount.id === requested);
  if (byId.length > 0) {
    return byId;
  }
  const wanted = requested.toLowerCase();
  return mounts.filter((mount) => (mount.mountName ?? '').toLowerCase() === wanted);
};

export const pickAutoMount = ({
  role,
  requested,
  mounts,
  primaryMountId,
}: PickMountParams): MountPickOutcome => {
  if (requested !== null) {
    const matches = namedMatches({ requested, mounts });
    const first = matches[0];
    if (first === undefined) {
      return refuse({
        code: 'mount_missing',
        message: `There is no mount ${requested} in this conversation.`,
        mounts,
      });
    }
    if (matches.length > 1) {
      return refuse({
        code: 'mount_ambiguous',
        message: `More than one mount is called ${requested}. Name one by its id.`,
        mounts: matches,
      });
    }
    if (!isUsableMount({ mount: first })) {
      return refuse({
        code: 'mount_missing',
        message: `The mount ${requested} has no folder on disk right now.`,
        mounts,
      });
    }
    return { kind: 'picked', mount: first, source: 'named' };
  }
  if (isAutoWriterRole({ role })) {
    return refuse({
      code: 'mount_missing',
      message: `A ${role} changes files, so you must name the mount it works in. If the request does not say which, ask the user.`,
      mounts,
    });
  }
  const primary = mounts.find((mount) => mount.id === primaryMountId);
  if (primary === undefined || !isUsableMount({ mount: primary })) {
    return refuse({
      code: 'mount_missing',
      message: 'This conversation has no main mount to read in. Name one.',
      mounts,
    });
  }
  return { kind: 'picked', mount: primary, source: 'primary' };
};
