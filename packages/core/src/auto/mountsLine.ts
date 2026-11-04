import { isUsableMount, type PickableMount } from './mountPick';

export const NO_MOUNTS_LINE =
  'MOUNTS: none attached yet. This does not stop any work: delegate a role that changes files as usual and Goodboy attaches the project the task names or asks the user which folder, or send a mount block to attach a project yourself.';

type MountsLineParams = {
  readonly mounts: ReadonlyArray<PickableMount>;
};

export const buildMountsLine = ({ mounts }: MountsLineParams): string => {
  const usable = mounts.filter((mount) => isUsableMount({ mount }));
  if (usable.length === 0) {
    return NO_MOUNTS_LINE;
  }
  const entries = usable.map(
    (mount) => `${mount.id} (${mount.mountName ?? 'unnamed'}, branch ${mount.branch})`,
  );
  return `MOUNTS: ${entries.join('; ')}.`;
};
