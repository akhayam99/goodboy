import { useMemo } from 'react';
import type { DiffCommentAnchor, DiffCommentSide, DiffHunk } from '@goodboy/types';
import type { DiffThread } from '../../components/DiffView/types';
import { placeThreads } from '../../lib/threadPlacement';

type Params = {
  readonly threads: ReadonlyArray<DiffThread>;
  readonly hunks: ReadonlyArray<DiffHunk>;
  readonly isBodyLoaded: boolean;
};

export type FileThreads = {
  readonly onLines: ReadonlyMap<string, ReadonlyArray<DiffThread>>;
  readonly onFile: ReadonlyArray<DiffThread>;
  readonly outdated: ReadonlyArray<DiffThread>;
  readonly commentedSpots: ReadonlySet<string>;
  readonly openCount: number;
};

type AnchorParams = {
  readonly anchor: DiffCommentAnchor;
};

type SpotParams = {
  readonly side: DiffCommentSide;
  readonly line: number;
};

export const spotKey = ({ side, line }: SpotParams): string => `${side}:${line}`;

export const anchorEnd = ({ anchor }: AnchorParams): number =>
  anchor.endLineNumber ?? anchor.lineNumber;

export const useFileThreads = ({ threads, hunks, isBodyLoaded }: Params): FileThreads =>
  useMemo(() => {
    const placed = placeThreads({ threads, hunks, isBodyLoaded });
    const onLines = new Map<string, DiffThread[]>();
    const commentedSpots = new Set<string>();
    for (const thread of placed.onLines) {
      const { anchor } = thread;
      if (anchor === null) {
        continue;
      }
      const key = spotKey({ side: anchor.side, line: anchorEnd({ anchor }) });
      onLines.set(key, [...(onLines.get(key) ?? []), thread]);
      if (thread.isResolved) {
        continue;
      }
      for (let line = anchor.lineNumber; line <= anchorEnd({ anchor }); line += 1) {
        commentedSpots.add(spotKey({ side: anchor.side, line }));
      }
    }
    return {
      onLines,
      onFile: placed.onFile,
      outdated: placed.outdated.map((thread) => ({ ...thread, isOutdated: true })),
      commentedSpots,
      openCount: threads.filter((thread) => !thread.isResolved).length,
    };
  }, [hunks, isBodyLoaded, threads]);
