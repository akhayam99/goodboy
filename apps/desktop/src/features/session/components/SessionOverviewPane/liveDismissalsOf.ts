import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { mismatchDismissalKeyOf } from './mismatchDismissalKeyOf';

type Params = {
  readonly dismissedKeys: ReadonlySet<string>;
  readonly rows: ReadonlyArray<MountRowView>;
};

export const liveDismissalsOf = ({ dismissedKeys, rows }: Params): ReadonlySet<string> => {
  const liveKeys = new Set(
    rows.flatMap((row) =>
      row.observation === null ? [] : [mismatchDismissalKeyOf({ observation: row.observation })],
    ),
  );
  const kept = [...dismissedKeys].filter((key) => liveKeys.has(key));
  return kept.length === dismissedKeys.size ? dismissedKeys : new Set(kept);
};
