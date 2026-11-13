import type { ReactNode } from 'react';
import { CircleAlert, Bot, Check, MessageSquare, Pencil, CircleX } from 'lucide-react';
import { ICON_SIZE, cn, tintClasses } from '@goodboy/ui';
import type { PullRequestNouns } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { countNoun } from '../../../../shared/utils/countNoun';
import type { ActivityItem } from './activityOf';
import { ActivityWho as Who } from './ActivityWho';

type RowComment = {
  readonly text: string;
};

export type ActivityRow = {
  readonly glyph: ReactNode;
  readonly line: ReactNode;
  readonly comments: ReadonlyArray<RowComment>;
  readonly notes?: ReadonlyArray<string>;
  readonly open: { readonly label: string; readonly run: () => void } | null;
};

type Params = {
  readonly item: ActivityItem;
  readonly nouns: PullRequestNouns;
  readonly baseBranch: string;
  readonly onOpenComments: () => void;
  readonly onOpenChecks: () => void;
};

const GLYPH_SIZE = ICON_SIZE.row;

type CommentsWordParams = {
  readonly item: Extract<ActivityItem, { kind: 'comments' }>;
};

const commentsLine = ({ item }: CommentsWordParams): string => {
  if (item.open === 0) {
    return 'All threads on files resolved';
  }
  const open = `${countNoun({ count: item.open, one: 'open thread', many: 'open threads' })} on files`;
  if (item.needYou === 0) {
    return open;
  }
  return `${open}, ${countNoun({ count: item.needYou, one: 'needs', many: 'need' })} you`;
};

export const activityRowOf = ({
  item,
  nouns,
  baseBranch,
  onOpenComments,
  onOpenChecks,
}: Params): ActivityRow => {
  switch (item.kind) {
    case 'opened':
      return {
        glyph: <CONCEPT_ICONS.pr size={GLYPH_SIZE} aria-hidden />,
        line: (
          <>
            <Who login={item.who} avatarUrl={item.avatarUrl ?? null} /> opened this{' '}
            {item.isDraft ? 'draft ' : ''}
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
            <Who login={item.who} avatarUrl={item.avatarUrl ?? null} /> pushed{' '}
            {countNoun({ count: item.count, one: 'commit', many: 'commits' })}{' '}
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
            <Who login={item.who} avatarUrl={item.avatarUrl ?? null} isBot={item.isBot === true} />{' '}
            {item.verdict === 'approved'
              ? 'approved'
              : item.verdict === 'changes_requested'
                ? 'requested changes'
                : 'commented'}
          </>
        ),
        comments: item.text === '' ? [] : [{ text: item.text }],
        open: null,
      };
    case 'bot':
      return {
        glyph: <Bot size={GLYPH_SIZE} aria-hidden />,
        line: (
          <>
            <Who login={item.who} avatarUrl={item.avatarUrl ?? null} isBot />{' '}
            <span
              data-bot-tone={item.tone}
              className={cn(
                item.tone === 'neutral' ? 'text-muted-foreground' : tintClasses(item.tone).text,
              )}
            >
              {item.word}
            </span>
          </>
        ),
        comments: [],
        notes: item.notes,
        open: null,
      };
    case 'comments':
      return {
        glyph: <MessageSquare size={GLYPH_SIZE} aria-hidden />,
        line: commentsLine({ item }),
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
            <Who login="You" avatarUrl={null} /> edited the {item.what}
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
            <Who login={item.who} avatarUrl={item.avatarUrl ?? null} /> merged this {nouns.long}{' '}
            into <span className="text-code">{baseBranch}</span>
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
