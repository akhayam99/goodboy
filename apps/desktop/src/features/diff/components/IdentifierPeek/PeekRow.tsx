import { StateBadge } from '@goodboy/ui';
import type { GrepMatch } from '../../../worktree/worktree';

type Props = {
  readonly match: GrepMatch;
  readonly word: string;
  readonly isInChange: boolean;
  readonly onPick: (match: GrepMatch) => void;
};

type SplitParams = { readonly path: string };

const splitPath = ({ path }: SplitParams) => {
  const cut = path.lastIndexOf('/') + 1;
  return { folder: path.slice(0, cut), name: path.slice(cut) };
};

export const PeekRow = ({ match, word, isInChange, onPick }: Props) => {
  const { folder, name } = splitPath({ path: match.path });
  const start = match.column - 1;
  const isMarked = match.text.slice(start, start + word.length) === word;
  return (
    <button
      type="button"
      data-peek-row=""
      aria-label={`${match.path}:${match.line}`}
      onClick={() => onPick(match)}
      className="flex h-8 w-full shrink-0 cursor-pointer items-center gap-3 px-3 text-left transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
    >
      <span className="flex min-w-0 max-w-[45%] shrink-0 items-baseline text-label">
        <span className="min-w-0 truncate text-faint-foreground">{folder}</span>
        <span className="shrink-0 text-foreground">{name}</span>
        <span className="shrink-0 tabular-nums text-faint-foreground">:{match.line}</span>
      </span>
      <span className="min-w-0 flex-1 truncate whitespace-pre font-mono text-code text-muted-foreground">
        {isMarked ? (
          <>
            {match.text.slice(0, start)}
            <mark className="rounded-sm bg-transparent text-foreground underline underline-offset-2">
              {word}
            </mark>
            {match.text.slice(start + word.length)}
          </>
        ) : (
          match.text
        )}
      </span>
      {isInChange ? <StateBadge tone="info">In this change</StateBadge> : null}
    </button>
  );
};
