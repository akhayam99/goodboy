import type { ReactNode } from 'react';
import { CircleAlert, Bot, Check, MessageSquare, Pencil, CircleX } from 'lucide-react';
import { ClampedProse, ICON_SIZE, SectionHeader, SelectableRow } from '@goodboy/ui';
import type { PullRequestNouns } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import type { ActivityItem } from './activityOf';
import { ActivityWho as Who } from './ActivityWho';

type Props = {
  readonly items: ReadonlyArray<ActivityItem>;
  readonly nouns: PullRequestNouns;
  readonly baseBranch: string;
  readonly onOpenComments: () => void;
  readonly onOpenChecks: () => void;
};

type RowComment = {
  readonly who: string | null;
  readonly text: string;
};

type Row = {
  readonly glyph: ReactNode;
  readonly line: ReactNode;
  readonly comments: ReadonlyArray<RowComment>;
  readonly open: { readonly label: string; readonly run: () => void } | null;
};

const GLYPH_SIZE = ICON_SIZE.row;

const plural = ({
  count,
  one,
  many,
}: {
  readonly count: number;
  readonly one: string;
  readonly many: string;
}): string => `${count} ${count === 1 ? one : many}`;

const commentsWord = ({ item }: { readonly item: Extract<ActivityItem, { kind: 'comments' }> }) => {
  if (item.needYou > 0) {
    return `${item.needYou} ${item.needYou === 1 ? 'needs' : 'need'} you`;
  }
  return item.open > 0 ? `${item.open} open` : 'all resolved';
};

const rowOf = ({
  item,
  nouns,
  baseBranch,
  onOpenComments,
  onOpenChecks,
}: Omit<Props, 'items'> & { readonly item: ActivityItem }): Row => {
  switch (item.kind) {
    case 'opened':
      return {
        glyph: <CONCEPT_ICONS.pr size={GLYPH_SIZE} aria-hidden />,
        line: (
          <>
            <Who name={item.who} /> opened this {item.isDraft ? 'draft ' : ''}
            {nouns.long}
          </>
        ),
        comments: [],
        open: null,
      };
    case 'push':
      return {
        glyph: <CONCEPT_ICONS.commits size={GLYPH_SIZE} aria-hidden />,
        line: (
          <>
            <Who name={item.who} /> pushed{' '}
            {plural({ count: item.count, one: 'commit', many: 'commits' })}{' '}
            <span className="text-code">{item.sha}</span>
          </>
        ),
        comments: [],
        open: null,
      };
    case 'review':
      return {
        glyph:
          item.verdict === 'approved' ? (
            <Check size={GLYPH_SIZE} aria-hidden className="text-success" />
          ) : item.verdict === 'changes_requested' ? (
            <CircleAlert size={GLYPH_SIZE} aria-hidden className="text-danger" />
          ) : (
            <MessageSquare size={GLYPH_SIZE} aria-hidden />
          ),
        line: (
          <>
            <Who name={item.who} />{' '}
            {item.verdict === 'approved'
              ? 'approved'
              : item.verdict === 'changes_requested'
                ? 'requested changes'
                : 'commented'}
          </>
        ),
        comments: item.text === '' ? [] : [{ who: null, text: item.text }],
        open: null,
      };
    case 'bots':
      return {
        glyph: <Bot size={GLYPH_SIZE} aria-hidden />,
        line:
          item.comments.length === 1 ? (
            <>
              <Who name={item.comments[0]?.who ?? null} /> commented
            </>
          ) : (
            <>{plural({ count: item.comments.length, one: 'bot', many: 'bots' })} commented</>
          ),
        comments:
          item.comments.length === 1
            ? item.comments.map((comment) => ({ who: null, text: comment.text }))
            : item.comments,
        open: null,
      };
    case 'comments':
      return {
        glyph: <MessageSquare size={GLYPH_SIZE} aria-hidden />,
        line: (
          <>
            {plural({ count: item.total, one: 'comment', many: 'comments' })} on files,{' '}
            {commentsWord({ item })}
          </>
        ),
        comments: [],
        open: { label: 'Open comments', run: onOpenComments },
      };
    case 'checks':
      return {
        glyph: item.isFailing ? (
          <CircleX size={GLYPH_SIZE} aria-hidden className="text-danger" />
        ) : item.isRunning ? (
          <CONCEPT_ICONS.checks size={GLYPH_SIZE} aria-hidden className="text-info" />
        ) : (
          <Check size={GLYPH_SIZE} aria-hidden className="text-success" />
        ),
        line: <>{item.text}</>,
        comments: [],
        open: { label: 'Open checks', run: onOpenChecks },
      };
    case 'edit':
      return {
        glyph: <Pencil size={GLYPH_SIZE} aria-hidden />,
        line: (
          <>
            <Who name="You" /> edited the {item.what}
          </>
        ),
        comments: [],
        open: null,
      };
    case 'merged':
      return {
        glyph: <CONCEPT_ICONS.merge size={GLYPH_SIZE} aria-hidden className="text-merged" />,
        line: (
          <>
            <Who name={item.who} /> merged this {nouns.long} into{' '}
            <span className="text-code">{baseBranch}</span>
          </>
        ),
        comments: [],
        open: null,
      };
    case 'closed':
      return {
        glyph: <CircleX size={GLYPH_SIZE} aria-hidden />,
        line: <>This {nouns.long} was closed</>,
        comments: [],
        open: null,
      };
    default: {
      const unreachable: never = item;
      return unreachable;
    }
  }
};

export const PullRequestActivity = ({
  items,
  nouns,
  baseBranch,
  onOpenComments,
  onOpenChecks,
}: Props) => {
  const now = useNow(60_000);
  return (
    <section aria-label="Activity" className="flex min-w-0 flex-col gap-3">
      <SectionHeader label="Activity" headingLevel={2} />
      <ol className="flex min-w-0 flex-col">
        {items.map((item, index) => {
          const row = rowOf({ item, nouns, baseBranch, onOpenComments, onOpenChecks });
          const age = formatAge({ from: item.at, now });
          const content = (
            <>
              <span className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-muted-foreground">
                {row.glyph}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
                  <span className="min-w-0 flex-1">{row.line}</span>
                  {row.open !== null && (
                    <span className="shrink-0 text-meta text-faint-foreground">
                      {row.open.label}
                    </span>
                  )}
                  {age !== '' && (
                    <time
                      dateTime={item.at}
                      className="shrink-0 text-meta tabular-nums text-faint-foreground"
                    >
                      {age}
                    </time>
                  )}
                </span>
                {row.comments.length === 0 ? null : (
                  <ul className="flex min-w-0 flex-col gap-2">
                    {row.comments.map((comment, position) => (
                      <li
                        key={`${comment.who ?? ''}:${position}`}
                        className="flex min-w-0 flex-col gap-1 rounded-md bg-subtle px-3 py-2"
                      >
                        {comment.who === null ? null : (
                          <span className="text-meta text-muted-foreground">{comment.who}</span>
                        )}
                        <span className="min-w-0 text-meta text-foreground">
                          <ClampedProse text={comment.text} lines={2} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            </>
          );
          return (
            <li key={item.key} data-activity={item.kind} className="relative min-w-0">
              {index === items.length - 1 ? null : (
                <span
                  aria-hidden
                  data-slot="activity-spine"
                  className="absolute bottom-0 left-4.5 top-6 w-px bg-border-soft"
                />
              )}
              {row.open === null ? (
                <div className="flex min-h-8 min-w-0 items-start gap-2 px-2 py-1">{content}</div>
              ) : (
                <SelectableRow
                  selected={false}
                  onClick={row.open.run}
                  className="min-h-8 min-w-0 items-start gap-2 px-2 py-1"
                >
                  {content}
                </SelectableRow>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
