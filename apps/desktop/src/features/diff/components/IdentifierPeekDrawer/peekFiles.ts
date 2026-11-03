import type { GrepMatch } from '../../../worktree/worktree';
import { PEEK_GROUP_LABELS } from '../IdentifierPeek/peekGroupLabels';
import { peekGroups } from '../IdentifierPeek/peekGroups';

type Params = {
  readonly matches: ReadonlyArray<GrepMatch>;
  readonly word: string;
  readonly changedPaths: ReadonlySet<string>;
};

type FilesParams = {
  readonly matches: ReadonlyArray<GrepMatch>;
  readonly changedPaths: ReadonlySet<string>;
};

export type PeekFile = {
  readonly path: string;
  readonly line: number;
  readonly count: number;
  readonly isChanged: boolean;
};

export type PeekFileGroup = {
  readonly key: keyof typeof PEEK_GROUP_LABELS;
  readonly label: string;
  readonly files: ReadonlyArray<PeekFile>;
};

const groupByFile = ({ matches, changedPaths }: FilesParams): ReadonlyArray<PeekFile> => {
  const byPath = new Map<string, PeekFile>();
  for (const match of matches) {
    const seen = byPath.get(match.path);
    byPath.set(
      match.path,
      seen === undefined
        ? {
            path: match.path,
            line: match.line,
            count: 1,
            isChanged: changedPaths.has(match.path),
          }
        : { ...seen, count: seen.count + 1 },
    );
  }
  return Array.from(byPath.values());
};

export const peekFiles = ({
  matches,
  word,
  changedPaths,
}: Params): ReadonlyArray<PeekFileGroup> => {
  const groups = peekGroups({ matches, word, changedPaths, isExpanded: true });
  const definitionPaths = new Set(groups.definitions.map((match) => match.path));
  const definitionMatches = matches.filter((match) => definitionPaths.has(match.path));
  const definitionLines = new Map(
    groupByFile({ matches: groups.definitions, changedPaths }).map((file) => [file.path, file]),
  );
  const definitionFiles = groupByFile({ matches: definitionMatches, changedPaths }).map((file) => ({
    ...file,
    line: definitionLines.get(file.path)?.line ?? file.line,
  }));
  const all: ReadonlyArray<PeekFileGroup> = [
    { key: 'definitions', label: PEEK_GROUP_LABELS.definitions, files: definitionFiles },
    {
      key: 'changed',
      label: PEEK_GROUP_LABELS.changed,
      files: groupByFile({ matches: groups.inChange, changedPaths }),
    },
    {
      key: 'unchanged',
      label: PEEK_GROUP_LABELS.unchanged,
      files: groupByFile({ matches: groups.elsewhere, changedPaths }),
    },
  ];
  return all.filter((group) => group.files.length > 0);
};
