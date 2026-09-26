import type { ResolveQueueRow } from './buildResolveQueueRows';

export type ThreadLocation = {
  readonly label: string;
  readonly shortLabel: string;
  readonly path: string | null;
  readonly line: number | null;
};

const baseName = (path: string): string => path.split('/').pop() ?? path;

const withLine = ({ text, line }: { readonly text: string; readonly line: number | null }) =>
  line === null ? text : `${text}:${line}`;

export const threadLocationOf = ({
  row,
}: {
  readonly row: ResolveQueueRow;
}): ThreadLocation | null => {
  const note = row.reviewerNote;
  const head = row.commentThread?.head ?? null;
  const path = note?.path ?? head?.path ?? null;
  const line = note?.line ?? head?.line ?? null;
  if (path !== null && path !== '') {
    return {
      label: note?.location ?? withLine({ text: path, line }),
      shortLabel: withLine({ text: baseName(path), line }),
      path,
      line,
    };
  }
  const location = note?.location ?? null;
  if (location !== null && location !== '') {
    return { label: location, shortLabel: location, path: null, line: null };
  }
  return null;
};
