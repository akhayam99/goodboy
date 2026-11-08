import { isBotLogin } from '@goodboy/core/review-source';
import type { PrCheckRun, PrDetail, PullRequestView } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { checksCountsOf, checksWordOf } from '../../../integrations/github/checksRollup';
import type { PullRequestEdit } from '../../../../store/slices/pull-request-view/state';
import type { ThreadEntry } from '../../../resolve/commentGroupsView';
import type { MergeBoxThreads } from './MergeBox/mergeBoxOf';
import { foldPushes } from './foldPushes';
import { groupBotActivity } from './groupBotActivity';

type ReviewVerdict = 'approved' | 'changes_requested' | 'commented';

export type ActivityItem =
  | {
      readonly kind: 'opened';
      readonly key: string;
      readonly at: string;
      readonly who: string | null;
      readonly isDraft: boolean;
    }
  | {
      readonly kind: 'push';
      readonly key: string;
      readonly at: string;
      readonly who: string | null;
      readonly count: number;
      readonly sha: string;
    }
  | {
      readonly kind: 'review';
      readonly key: string;
      readonly at: string;
      readonly who: string;
      readonly verdict: ReviewVerdict;
      readonly text: string;
      readonly isBot?: boolean;
    }
  | {
      readonly kind: 'comments';
      readonly key: string;
      readonly at: string;
      readonly total: number;
      readonly needYou: number;
      readonly open: number;
      readonly hasPeople: boolean;
      readonly hasBots: boolean;
    }
  | {
      readonly kind: 'checks';
      readonly key: string;
      readonly at: string;
      readonly text: string;
      readonly isRunning: boolean;
      readonly isFailing: boolean;
    }
  | {
      readonly kind: 'bot';
      readonly key: string;
      readonly at: string;
      readonly who: string;
      readonly word: string;
      readonly tone: Tone;
      readonly notes: ReadonlyArray<string>;
    }
  | { readonly kind: 'edit'; readonly key: string; readonly at: string; readonly what: string }
  | {
      readonly kind: 'merged';
      readonly key: string;
      readonly at: string;
      readonly who: string | null;
    }
  | { readonly kind: 'closed'; readonly key: string; readonly at: string };

type Params = {
  readonly view: PullRequestView;
  readonly detail: PrDetail | null;
  readonly runs: ReadonlyArray<PrCheckRun> | null;
  readonly threads: Pick<MergeBoxThreads, 'needYou'> & { readonly open: number };
  readonly entries: ReadonlyArray<ThreadEntry>;
  readonly edits: ReadonlyArray<PullRequestEdit>;
};

const SHORT_SHA = 7;

const dayOf = ({ iso }: { readonly iso: string }): string => iso.slice(0, 10);

const handleOf = ({
  view,
  author,
}: {
  readonly view: PullRequestView;
  readonly author: string | null;
}): string | null =>
  view.author !== null && author !== null && author === view.author.name
    ? view.author.login
    : author;

const pushesOf = ({ view }: { readonly view: PullRequestView }): ReadonlyArray<ActivityItem> => {
  const groups = new Map<string, { who: string | null; count: number; at: string; sha: string }>();
  for (const commit of view.commits) {
    if (commit.committedAt === '') {
      continue;
    }
    const key = `${dayOf({ iso: commit.committedAt })}|${commit.author ?? ''}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {
        who: handleOf({ view, author: commit.author }),
        count: 1,
        at: commit.committedAt,
        sha: commit.sha,
      });
      continue;
    }
    group.count += 1;
    if (commit.committedAt >= group.at) {
      group.at = commit.committedAt;
      group.sha = commit.sha;
    }
  }
  return [...groups.entries()].map(([key, group]) => ({
    kind: 'push',
    key: `push:${key}`,
    at: group.at,
    who: group.who,
    count: group.count,
    sha: group.sha.slice(0, SHORT_SHA),
  }));
};

type DetailParams = {
  readonly detail: PrDetail | null;
};

const botFlagsOf = ({ detail }: DetailParams): ReadonlyMap<string, boolean> =>
  new Map(
    (detail?.reviews ?? []).flatMap((review): ReadonlyArray<[string, boolean]> =>
      review.isAuthorBot === undefined ? [] : [[review.author, review.isAuthorBot]],
    ),
  );

const reviewsOf = ({ detail }: DetailParams): ReadonlyArray<ActivityItem> => {
  const flags = botFlagsOf({ detail });
  return (detail?.reviews ?? []).flatMap((review): ReadonlyArray<ActivityItem> => {
    if (review.submittedAt === null || review.state === 'pending' || review.state === 'dismissed') {
      return [];
    }
    if (review.state === 'commented' && review.body.trim() === '') {
      return [];
    }
    return [
      {
        kind: 'review',
        key: `review:${review.id}`,
        at: review.submittedAt,
        who: review.author,
        verdict: review.state,
        text: review.body.trim(),
        ...(flags.has(review.author) ? { isBot: flags.get(review.author) === true } : {}),
      },
    ];
  });
};

const commentsOf = ({
  detail,
  threads: counts,
}: Pick<Params, 'detail' | 'threads'>): ReadonlyArray<ActivityItem> => {
  const comments = (detail?.comments ?? []).filter((comment) => comment.source === 'review');
  const threads = new Set(comments.map((comment) => comment.threadId ?? comment.id));
  if (threads.size === 0) {
    return [];
  }
  const latest = comments.reduce(
    (at, comment) => (comment.createdAt > at ? comment.createdAt : at),
    '',
  );
  const flags = botFlagsOf({ detail });
  const isBotAuthor = ({ login }: { readonly login: string }): boolean => {
    const isBot = flags.get(login);
    return isBotLogin({ login, ...(isBot === undefined ? {} : { isBot }) });
  };
  return [
    {
      kind: 'comments',
      key: 'comments',
      at: latest,
      total: threads.size,
      needYou: counts.needYou,
      open: counts.open,
      hasPeople: comments.some((comment) => !isBotAuthor({ login: comment.author })),
      hasBots: comments.some((comment) => isBotAuthor({ login: comment.author })),
    },
  ];
};

const checksOf = ({
  view,
  runs,
}: {
  readonly view: PullRequestView;
  readonly runs: ReadonlyArray<PrCheckRun> | null;
}): ReadonlyArray<ActivityItem> => {
  const word = checksWordOf({ runs });
  if (runs === null || word === null) {
    return [];
  }
  const counts = checksCountsOf({ checks: runs });
  return [
    {
      kind: 'checks',
      key: 'checks',
      at: view.updatedAt,
      text: `Checks ${word}`,
      isRunning: counts.running > 0 && counts.failing === 0,
      isFailing: counts.failing > 0,
    },
  ];
};

const endOf = ({ view }: { readonly view: PullRequestView }): ReadonlyArray<ActivityItem> => {
  if (view.state === 'merged' && view.mergedAt !== null) {
    return [{ kind: 'merged', key: 'merged', at: view.mergedAt, who: view.author?.login ?? null }];
  }
  if (view.state === 'closed') {
    return [{ kind: 'closed', key: 'closed', at: view.updatedAt }];
  }
  return [];
};

export const pullRequestActivityOf = ({
  view,
  detail,
  runs,
  threads,
  entries,
  edits,
}: Params): ReadonlyArray<ActivityItem> => {
  const items: ReadonlyArray<ActivityItem> = [
    {
      kind: 'opened',
      key: 'opened',
      at: view.createdAt,
      who: view.author?.login ?? null,
      isDraft: view.isDraft,
    },
    ...pushesOf({ view }),
    ...reviewsOf({ detail }),
    ...commentsOf({ detail, threads }),
    ...checksOf({ view, runs }),
    ...edits.map((edit, index): ActivityItem => ({
      kind: 'edit',
      key: `edit:${index}:${edit.at}`,
      at: edit.at,
      what: edit.what,
    })),
    ...endOf({ view }),
  ];
  return groupBotActivity({
    items: foldPushes({
      items: items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => a.item.at.localeCompare(b.item.at) || a.index - b.index)
        .map(({ item }) => item),
    }),
    comments: detail?.comments ?? null,
    entries,
  });
};
