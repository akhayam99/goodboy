import type { ReactNode } from 'react';
import { Check, MessageSquare, Pencil, CircleX } from 'lucide-react';
import { ICON_SIZE, cn, tintClasses } from '@goodboy/ui';
import type { PullRequestNouns } from '@goodboy/types';
import { CONCEPT_ICONS } from '../conceptIcons';
import { countNoun } from '../../utils/countNoun';
import type { ActivityItem } from './activityItem';
import { ActivityWho as Who } from './ActivityWho';
import { pushLineOf } from './pushLineOf';

type RowComment = {
  readonly text: string;
};

export type ActivityLead =
  | {
      readonly kind: 'person';
      readonly login: string | null;
      readonly avatarUrl: string | null;
      readonly isBot: boolean;
    }
  | { readonly kind: 'glyph'; readonly glyph: ReactNode };

export type ActivityRow = {
  readonly lead: ActivityLead;
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

type PersonParams = {
  readonly login: string | null;
  readonly avatarUrl: string | null | undefined;
  readonly isBot?: boolean;
};

const personLeadOf = ({ login, avatarUrl, isBot = false }: PersonParams): ActivityLead => ({
  kind: 'person',
  login,
  avatarUrl: avatarUrl ?? null,
  isBot,
});

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
        lead: personLeadOf({ login: item.who, avatarUrl: item.avatarUrl }),
        line: (
          <>
            <Who login={item.who} /> opened this {item.isDraft ? 'draft ' : ''}
            {nouns.long}
          </>
        ),
        comments: [],
        open: null,
      };
    case 'push':
      return {
        lead: personLeadOf({ login: item.who, avatarUrl: item.avatarUrl }),
        line: (
          <>
            <Who login={item.who} /> {pushLineOf({ item })}
          </>
        ),
        comments: [],
        open: null,
      };
    case 'review':
      return {
        lead: personLeadOf({
          login: item.who,
          avatarUrl: item.avatarUrl,
          isBot: item.isBot === true,
        }),
        line: (
          <>
            <Who login={item.who} />{' '}
            {item.verdict === 'approved'
              ? 'approved'
              : item.verdict === 'changes_requested'
                ? 'asked for changes'
                : 'commented'}
          </>
        ),
        comments: item.text === '' ? [] : [{ text: item.text }],
        open: null,
      };
    case 'bot':
      return {
        lead: personLeadOf({ login: item.who, avatarUrl: item.avatarUrl, isBot: true }),
        line: (
          <>
            <Who login={item.who} /> left{' '}
            {countNoun({ count: item.count, one: 'comment', many: 'comments' })}
            {item.tone === 'neutral' ? null : (
              <span data-bot-tone={item.tone} className={cn(tintClasses(item.tone).text)}>
                {' '}
                · {item.word}
              </span>
            )}
          </>
        ),
        comments: [],
        notes: item.notes,
        open: null,
      };
    case 'comments':
      return {
        lead: { kind: 'glyph', glyph: <MessageSquare size={GLYPH_SIZE} aria-hidden /> },
        line: commentsLine({ item }),
        comments: [],
        open: { label: 'Open comments', run: onOpenComments },
      };
    case 'checks':
      return {
        lead: {
          kind: 'glyph',
          glyph: item.isFailing ? (
            <CircleX size={GLYPH_SIZE} aria-hidden className="text-danger" />
          ) : item.isRunning ? (
            <CONCEPT_ICONS.checks size={GLYPH_SIZE} aria-hidden className="text-info" />
          ) : (
            <Check size={GLYPH_SIZE} aria-hidden className="text-success" />
          ),
        },
        line: <>{item.text}</>,
        comments: [],
        open: { label: 'Open checks', run: onOpenChecks },
      };
    case 'edit':
      return {
        lead: { kind: 'glyph', glyph: <Pencil size={GLYPH_SIZE} aria-hidden /> },
        line: (
          <>
            <Who login="You" /> edited the {item.what}
          </>
        ),
        comments: [],
        open: null,
      };
    case 'merged':
      return {
        lead: personLeadOf({ login: item.who, avatarUrl: item.avatarUrl }),
        line: (
          <>
            <Who login={item.who} /> merged this {nouns.long} into{' '}
            <span className="text-code">{baseBranch}</span>
          </>
        ),
        comments: [],
        open: null,
      };
    case 'closed':
      return {
        lead: { kind: 'glyph', glyph: <CircleX size={GLYPH_SIZE} aria-hidden /> },
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
