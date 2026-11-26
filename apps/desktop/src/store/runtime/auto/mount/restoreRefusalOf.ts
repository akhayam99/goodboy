import type { AutoRefusalCode } from '@goodboy/core/auto';
import type { ChildMountPick } from '../pickChildMount';

export type RestorableMount = Readonly<{
  mountId: string;
  mountName: string;
}>;

type RestoreRefusal = Readonly<{
  slot: number;
  code: AutoRefusalCode;
  message: string;
  restore: RestorableMount;
}>;

type Params = {
  readonly slot: number;
  readonly picked: Extract<ChildMountPick, { kind: 'restore_failed' }>;
};

export const restoreRefusalOf = ({ slot, picked }: Params): RestoreRefusal => {
  const mountName = picked.mount.mountName ?? 'project';
  return {
    slot,
    code: 'mount_missing',
    message: `The ${mountName} folder was removed and could not be brought back: ${picked.error}`,
    restore: { mountId: picked.mount.id, mountName },
  };
};
