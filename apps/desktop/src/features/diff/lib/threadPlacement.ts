import type { DiffCommentAnchor, DiffHunk } from '@goodboy/types';
import type { DiffThread } from '../components/DiffView/types';

export type ThreadPlacement = {
  readonly onLines: ReadonlyArray<DiffThread>;
  readonly onFile: ReadonlyArray<DiffThread>;
  readonly outdated: ReadonlyArray<DiffThread>;
};

type Params = {
  readonly threads: ReadonlyArray<DiffThread>;
  readonly hunks: ReadonlyArray<DiffHunk>;
  readonly isBodyLoaded: boolean;
};

type AnchorParams = {
  readonly anchor: DiffCommentAnchor;
};

const anchorEndOf = ({ anchor }: AnchorParams): number => anchor.endLineNumber ?? anchor.lineNumber;

export const spotKeysOf = ({ hunks }: Pick<Params, 'hunks'>): ReadonlySet<string> => {
  const keys = new Set<string>();
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind !== 'add' && line.oldLine !== null) {
        keys.add(`old:${line.oldLine}`);
      }
      if (line.kind !== 'del' && line.newLine !== null) {
        keys.add(`new:${line.newLine}`);
      }
    }
  }
  return keys;
};

export const placeThreads = ({ threads, hunks, isBodyLoaded }: Params): ThreadPlacement => {
  const spots = spotKeysOf({ hunks });
  const onLines: Array<DiffThread> = [];
  const onFile: Array<DiffThread> = [];
  const outdated: Array<DiffThread> = [];
  for (const thread of threads) {
    if (thread.anchor === null) {
      (thread.isOutdated === true ? outdated : onFile).push(thread);
      continue;
    }
    const isGone =
      thread.isOutdated === true ||
      (isBodyLoaded &&
        thread.source === 'host' &&
        !spots.has(`${thread.anchor.side}:${anchorEndOf({ anchor: thread.anchor })}`));
    (isGone ? outdated : onLines).push(thread);
  }
  return { onLines, onFile, outdated };
};
