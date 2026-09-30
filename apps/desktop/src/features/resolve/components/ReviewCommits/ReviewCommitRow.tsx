import { useState, type KeyboardEvent } from 'react';
import { Bot, Cloud, GitCommitHorizontal } from 'lucide-react';
import { Input, Listbox, cn, type ListboxOption } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ReviewCommitChoice, ReviewCommitRow as Row } from '../../reviewCommits';
import {
  REVIEW_COMMITS_LABEL,
  commitForLine,
  foldIntoLabel,
  withFixesFor,
} from '../../reviewCommitsCopy';

type Props = {
  readonly row: Row;
  readonly earlier: ReadonlyArray<Row>;
  readonly choice: ReviewCommitChoice;
  readonly isFoldedAway: boolean;
  readonly isDisabled: boolean;
  readonly includedAuthors: ReadonlyArray<string>;
  readonly onChoose: (choice: ReviewCommitChoice) => void;
  readonly onOpenThread: (threadId: string) => void;
};

const REWORD = 'reword';
const KEEP = 'keep';
const FOLD = 'fold:';

const valueOf = ({ choice }: { readonly choice: ReviewCommitChoice }): string => {
  if (choice.kind === 'fold') {
    return `${FOLD}${choice.target}`;
  }
  return choice.kind === 'reword' ? REWORD : KEEP;
};

const optionsOf = ({
  earlier,
}: {
  readonly earlier: ReadonlyArray<Row>;
}): ReadonlyArray<ListboxOption<string>> => [
  { value: KEEP, label: REVIEW_COMMITS_LABEL.keep },
  ...[...earlier].reverse().map((row, index) => ({
    value: `${FOLD}${row.sha}`,
    label:
      index === 0 && row.isResolve
        ? REVIEW_COMMITS_LABEL.squashAbove
        : foldIntoLabel({ shortSha: row.shortSha }),
    description: row.subject,
  })),
  { value: REWORD, label: REVIEW_COMMITS_LABEL.reword },
];

export const ReviewCommitRow = ({
  row,
  earlier,
  choice,
  isFoldedAway,
  isDisabled,
  includedAuthors,
  onChoose,
  onOpenThread,
}: Props) => {
  const [draft, setDraft] = useState<string | null>(null);
  const subject = choice.kind === 'reword' ? choice.message : row.subject;
  const Icon = row.isResolve ? Bot : GitCommitHorizontal;

  const choose = (value: string): void => {
    if (value === REWORD) {
      setDraft(subject);
      return;
    }
    setDraft(null);
    if (value.startsWith(FOLD)) {
      onChoose({ kind: 'fold', target: value.slice(FOLD.length) });
      return;
    }
    onChoose({ kind: 'keep' });
  };

  const onRewordKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
      return;
    }
    if (event.key !== 'Enter' || draft === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const message = draft.trim();
    setDraft(null);
    if (message !== '' && message !== row.subject) {
      onChoose({ kind: 'reword', message });
      return;
    }
    onChoose({ kind: 'keep' });
  };

  return (
    <li
      data-sha={row.sha}
      className="grid list-none grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 rounded-md px-2 py-2 hover:bg-hover motion-safe:transition-colors"
    >
      <span
        className={cn(
          'row-span-2 flex size-5 items-center justify-center self-center rounded-full border bg-background',
          row.isResolve
            ? 'border-agent-resolver/50 text-agent-resolver'
            : 'border-border text-muted-foreground',
        )}
        aria-hidden
      >
        <Icon size={ICON_SIZE.row} />
      </span>
      <span
        className={cn(
          'min-w-0 truncate text-row',
          isFoldedAway ? 'text-muted-foreground' : 'text-foreground',
        )}
        title={subject}
      >
        {subject}
      </span>
      {row.isResolve ? (
        <Listbox
          trigger="quiet"
          size="sm"
          align="end"
          ariaLabel={`What to do with ${row.shortSha}`}
          value={valueOf({ choice })}
          options={optionsOf({ earlier })}
          onChange={choose}
          disabled={isDisabled}
          {...(choice.kind === 'reword' && { valueLabel: REVIEW_COMMITS_LABEL.reworded })}
          className="w-52"
        />
      ) : (
        <span />
      )}
      <span className="col-start-2 col-end-4 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-secondary text-faint-foreground">
        <span className="shrink-0 font-mono text-muted-foreground">{row.shortSha}</span>
        {row.isResolve ? (
          row.threads.map((thread) => (
            <button
              key={thread.threadId}
              type="button"
              onClick={() => onOpenThread(thread.threadId)}
              className="min-w-0 truncate rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {commitForLine({ author: thread.author, location: thread.location })}
            </button>
          ))
        ) : (
          <>
            <span className="shrink-0">{REVIEW_COMMITS_LABEL.you}</span>
            {includedAuthors.length > 0 && (
              <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Bot size={ICON_SIZE.row} className="shrink-0 text-agent-resolver" aria-hidden />
                <span className="truncate">{withFixesFor({ authors: includedAuthors })}</span>
              </span>
            )}
          </>
        )}
        <span className="inline-flex shrink-0 items-center gap-1">
          {row.isPushed && <Cloud size={ICON_SIZE.row} aria-hidden />}
          {row.isPushed ? REVIEW_COMMITS_LABEL.onOrigin : REVIEW_COMMITS_LABEL.localOnly}
        </span>
      </span>
      {draft !== null && (
        <span className="col-start-2 col-end-4">
          <Input
            autoFocus
            aria-label={REVIEW_COMMITS_LABEL.rewordLabel}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onRewordKey}
            onBlur={() => setDraft(null)}
          />
        </span>
      )}
    </li>
  );
};
