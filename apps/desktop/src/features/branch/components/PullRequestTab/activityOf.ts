import type { PrCheckRun, PrDetail, PullRequestView } from '@goodboy/types';
import { openReviewThreadIds } from '../../../../store/slices/resolve/openReviewThreadIds';
import type { PullRequestEdit } from '../../../../store/slices/pull-request-view/state';

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
    }
  | {
      readonly kind: 'comments';
      readonly key: string;
      readonly at: string;
      readonly total: number;
      readonly needYou: number;
      readonly open: number;
    }
  | {
      readonly kind: 'checks';
      readonly key: string;
      readonly at: string;
      readonly text: string;
      readonly isRunning: boolean;
      readonly isFailing: boolean;
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
  readonly needYou: number;
  readonly edits: ReadonlyArray<PullRequestEdit>;
};

const SHORT_SHA = 7;

const dayOf = ({ iso }: { readonly iso: string }): string => iso.slice(0, 10);

const plural = ({
  count,
  one,
  many,
}: {
  readonly count: number;
  readonly one: string;
  readonly many: string;
}): string => `${count} ${count === 1 ? one : many}`;

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
        who: commit.author,
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

const reviewsOf = ({ detail }: { readonly detail: PrDetail | null }): ReadonlyArray<ActivityItem> =>
  (detail?.reviews ?? []).flatMap((review): ReadonlyArray<ActivityItem> => {
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
      },
    ];
  });

const commentsOf = ({
  detail,
  needYou,
}: {
  readonly detail: PrDetail | null;
  readonly needYou: number;
}): ReadonlyArray<ActivityItem> => {
  const comments = (detail?.comments ?? []).filter((comment) => comment.source === 'review');
  const threads = new Set(comments.map((comment) => comment.threadId ?? comment.id));
  if (threads.size === 0) {
    return [];
  }
  const latest = comments.reduce(
    (at, comment) => (comment.createdAt > at ? comment.createdAt : at),
    '',
  );
  return [
    {
      kind: 'comments',
      key: 'comments',
      at: latest,
      total: threads.size,
      needYou,
      open: openReviewThreadIds({ comments }).length,
    },
  ];
};

const FAILED: ReadonlySet<PrCheckRun['conclusion']> = new Set(['failure', 'timed_out']);

const checksOf = ({ view }: { readonly view: PullRequestView }): ReadonlyArray<ActivityItem> => {
  const { runs, read } = view.checks;
  if (read !== 'ok' || runs.length === 0) {
    return [];
  }
  const failing = runs.filter((run) => FAILED.has(run.conclusion)).length;
  const running = runs.filter((run) => run.conclusion === 'pending').length;
  const passed = runs.filter((run) => run.conclusion === 'success').length;
  const text =
    failing > 0
      ? `${plural({ count: failing, one: 'check', many: 'checks' })} failing, ${passed} passed`
      : running > 0
        ? `${plural({ count: passed, one: 'check', many: 'checks' })} passed, ${running} running`
        : `All ${runs.length} passed`;
  return [
    {
      kind: 'checks',
      key: 'checks',
      at: view.updatedAt,
      text,
      isRunning: running > 0 && failing === 0,
      isFailing: failing > 0,
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
  needYou,
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
    ...commentsOf({ detail, needYou }),
    ...checksOf({ view }),
    ...edits.map((edit, index): ActivityItem => ({
      kind: 'edit',
      key: `edit:${index}:${edit.at}`,
      at: edit.at,
      what: edit.what,
    })),
    ...endOf({ view }),
  ];
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.at.localeCompare(b.item.at) || a.index - b.index)
    .map(({ item }) => item);
};
