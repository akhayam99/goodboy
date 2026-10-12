import type { GrepMatch } from '../../../worktree/worktree';
import { definitionOf } from '../../lib/definitionOf';
import { definitionOfScope } from '../../lib/definitionOfScope';

type Params = {
  readonly matches: ReadonlyArray<GrepMatch>;
  readonly word: string;
  readonly changedPaths: ReadonlySet<string>;
  readonly changedLines?: ReadonlyMap<string, ReadonlySet<number>>;
  readonly isExpanded: boolean;
};

const ELSEWHERE_LIMIT = 5;

export const peekGroups = ({ matches, word, changedPaths, changedLines, isExpanded }: Params) => {
  const projectMatches = matches.filter(
    (match) => definitionOfScope({ path: match.path }) === 'project',
  );
  const declarations = projectMatches.map((match) => ({
    match,
    kind: definitionOf({ path: match.path, word, text: match.text }),
  }));
  const definitions = declarations.filter(({ kind }) => kind !== null).map(({ match }) => match);
  const references = declarations.filter(({ kind }) => kind === null).map(({ match }) => match);
  const inChange = references.filter((match) => changedPaths.has(match.path));
  inChange.sort(
    (left, right) =>
      Number(changedLines?.get(right.path)?.has(right.line) === true) -
      Number(changedLines?.get(left.path)?.has(left.line) === true),
  );
  const elsewhere = references.filter((match) => !changedPaths.has(match.path));
  const hiddenCount = isExpanded ? 0 : Math.max(0, elsewhere.length - ELSEWHERE_LIMIT);
  const changeCount = projectMatches.filter((match) => changedPaths.has(match.path)).length;
  return {
    definitions,
    inChange,
    elsewhere: isExpanded ? elsewhere : elsewhere.slice(0, ELSEWHERE_LIMIT),
    hiddenCount,
    firstRevealed: isExpanded ? elsewhere[ELSEWHERE_LIMIT] : undefined,
    kind: declarations.find(({ kind }) => kind !== null)?.kind ?? null,
    summary: `${definitions.length} ${definitions.length === 1 ? 'definition' : 'definitions'} · ${references.length} ${references.length === 1 ? 'use' : 'uses'} · ${changeCount} in this change`,
  };
};
