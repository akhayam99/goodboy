import type { ReactNode } from 'react';
import { AlertCircle, Check, MessageSquare, Pencil, XCircle } from 'lucide-react';
import { ClampedProse, ROW_INTERACTIVE, SectionHeader, cn } from '@goodboy/ui';
import type { PullRequestNouns } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
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

type Row = {
  readonly glyph: ReactNode;
  readonly line: ReactNode;
  readonly body: string | null;
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
    return `${item.needYou} need you`;
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
        body: null,
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
        body: null,
        open: null,
      };
    case 'review':
      return {
        glyph:
          item.verdict === 'approved' ? (
            <Check size={GLYPH_SIZE} aria-hidden className="text-success" />
          ) : item.verdict === 'changes_requested' ? (
            <AlertCircle size={GLYPH_SIZE} aria-hidden className="text-danger" />
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
        body: item.text === '' ? null : item.text,
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
        body: null,
        open: { label: 'Open Comments', run: onOpenComments },
      };
    case 'checks':
      return {
        glyph: item.isFailing ? (
          <XCircle size={GLYPH_SIZE} aria-hidden className="text-danger" />
        ) : item.isRunning ? (
          <CONCEPT_ICONS.checks size={GLYPH_SIZE} aria-hidden className="text-info" />
        ) : (
          <Check size={GLYPH_SIZE} aria-hidden className="text-success" />
        ),
        line: <>{item.text}</>,
        body: null,
        open: { label: 'View checks', run: onOpenChecks },
      };
    case 'edit':
      return {
        glyph: <Pencil size={GLYPH_SIZE} aria-hidden />,
        line: (
          <>
            <Who name="You" /> edited the {item.what}
          </>
        ),
        body: null,
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
        body: null,
        open: null,
      };
    case 'closed':
      return {
        glyph: <XCircle size={GLYPH_SIZE} aria-hidden />,
        line: <>This {nouns.long} was closed</>,
        body: null,
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
      <SectionHeader
        label="Activity"
        headingLevel={2}
        meta={<span className="text-meta tabular-nums text-faint-foreground">{items.length}</span>}
      />
      <ol className="flex min-w-0 flex-col">
        {items.map((item) => {
          const row = rowOf({ item, nouns, baseBranch, onOpenComments, onOpenChecks });
          const age = formatAge({ from: item.at, now });
          const content = (
            <>
              <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                {row.glyph}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex min-w-0 items-center gap-2 text-label text-muted-foreground">
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
                {row.body !== null && (
                  <span className="min-w-0 text-label text-muted-foreground">
                    <ClampedProse text={row.body} lines={2} />
                  </span>
                )}
              </span>
            </>
          );
          return (
            <li key={item.key} className="min-w-0">
              {row.open === null ? (
                <div className="flex min-h-8 min-w-0 items-start gap-2 px-2 py-1">{content}</div>
              ) : (
                <button
                  type="button"
                  onClick={row.open.run}
                  className={cn(
                    'flex min-h-8 w-full min-w-0 items-start gap-2 rounded-md px-2 py-1 text-left',
                    ROW_INTERACTIVE,
                  )}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
