import type { TranscriptRow } from '../../utils/cluster-operations';

export const planBlockVersions = ({
  rows,
}: {
  readonly rows: ReadonlyArray<TranscriptRow>;
}): ReadonlyMap<string, number> => {
  const versions = new Map<string, number>();
  for (const row of rows) {
    if (row.kind !== 'item') {
      continue;
    }
    const { item } = row;
    if (item.kind === 'artifact_block' && item.artifactKind === 'plan' && item.complete) {
      versions.set(item.key, versions.size + 1);
    }
  }
  return versions;
};
