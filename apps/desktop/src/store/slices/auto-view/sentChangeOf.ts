import { isUserPayload } from '@goodboy/core/auto';
import type { AutoOutboxRow, AutoTree } from '@goodboy/db';
import type { AutoSentChange } from './state';

type Params = {
  readonly tree: AutoTree;
  readonly rows: ReadonlyArray<AutoOutboxRow>;
};

type OpenParams = {
  readonly tree: AutoTree;
  readonly row: AutoOutboxRow;
};

const isUnread = ({ tree, row }: OpenParams): boolean =>
  row.kind === 'user' &&
  row.generation === tree.generation &&
  (row.state === 'pending' ||
    (row.state === 'accepted' &&
      row.acceptedRunId !== null &&
      row.acceptedRunId === tree.activeRunId));

export const sentChangeOf = ({ tree, rows }: Params): AutoSentChange | null => {
  const changes = rows.flatMap((row): ReadonlyArray<Readonly<{ at: number } & AutoSentChange>> => {
    if (!isUnread({ tree, row }) || !isUserPayload(row.payload)) {
      return [];
    }
    const change = row.payload.facts.explicitChange;
    if (change == null) {
      return [];
    }
    return [{ at: row.createdAt, artifactId: change.artifactId, revision: change.baseRevision }];
  });
  const latest = [...changes].sort((a, b) => b.at - a.at)[0];
  return latest === undefined ? null : { artifactId: latest.artifactId, revision: latest.revision };
};
