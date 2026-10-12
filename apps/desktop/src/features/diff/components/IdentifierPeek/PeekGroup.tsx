import type { GrepMatch } from '../../../worktree/worktree';
import { PeekRow } from './PeekRow';

type Props = {
  readonly label: string;
  readonly matches: ReadonlyArray<GrepMatch>;
  readonly word: string;
  readonly changedPaths: ReadonlySet<string>;
  readonly changedLines?: ReadonlyMap<string, ReadonlySet<number>>;
  readonly onPick: (match: GrepMatch) => void;
};

export const PeekGroup = ({ label, matches, word, changedPaths, changedLines, onPick }: Props) => {
  if (matches.length === 0) {
    return null;
  }
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <h3 className="px-2 text-eyebrow text-faint-foreground">{label}</h3>
      <div className="flex flex-col">
        {matches.map((match) => (
          <PeekRow
            key={`${match.path}:${match.line}:${match.column}`}
            match={match}
            word={word}
            isInChange={changedPaths.has(match.path)}
            isChangedLine={changedLines?.get(match.path)?.has(match.line) === true}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
};
