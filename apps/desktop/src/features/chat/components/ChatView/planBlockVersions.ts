import type { ConversationRow } from '../../utils/conversationRows';

export const planBlockVersions = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ConversationRow>;
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
