import { ROW_INTERACTIVE, StateBadge, Tooltip, cn } from '@goodboy/ui';
import type { GrepMatch } from '../../../worktree/worktree';
import { PeekPath } from './PeekPath';

type Props = {
  readonly match: GrepMatch;
  readonly word: string;
  readonly isInChange: boolean;
  readonly isChangedLine: boolean;
  readonly onPick: (match: GrepMatch) => void;
};

export const PeekRow = ({ match, word, isInChange, isChangedLine, onPick }: Props) => {
  const requestedStart = match.column - 1;
  const start =
    match.text.slice(requestedStart, requestedStart + word.length) === word
      ? requestedStart
      : match.text.indexOf(word);
  const isMarked = start >= 0;
  return (
    <button
      type="button"
      data-peek-row=""
      aria-label={`${match.path}:${match.line}`}
      onClick={() => onPick(match)}
      className={cn(
        ROW_INTERACTIVE,
        'grid min-h-8 w-full shrink-0 grid-cols-[minmax(0,max-content)_minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-2 text-left',
      )}
    >
      <Tooltip content={match.path}>
        <PeekPath path={match.path} line={match.line} />
      </Tooltip>
      <span
        data-peek-snippet=""
        className="min-w-0 truncate whitespace-pre text-code text-muted-foreground"
      >
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
      {isInChange ? (
        <StateBadge tone="info">{isChangedLine ? 'Changed line' : 'In this change'}</StateBadge>
      ) : null}
    </button>
  );
};
