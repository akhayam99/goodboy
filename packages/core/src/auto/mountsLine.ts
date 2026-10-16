import { isUsableMount, type PickableMount } from './mountPick';

type MountsLineParams = {
  readonly mounts: ReadonlyArray<PickableMount>;
};

export const buildMountsLine = ({ mounts }: MountsLineParams): string => {
  const usable = mounts.filter((mount) => isUsableMount({ mount }));
  if (usable.length === 0) {
    return 'MOUNTS: none. No agent that changes files can start in this conversation.';
  }
  const entries = usable.map(
    (mount) => `${mount.id} (${mount.mountName ?? 'unnamed'}, branch ${mount.branch})`,
  );
  return `MOUNTS: ${entries.join('; ')}.`;
};
