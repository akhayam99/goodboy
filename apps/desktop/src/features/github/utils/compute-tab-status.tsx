import type { ReactNode } from 'react';
import {
  AlertCircle,
  Check,
  CheckCheck,
  CircleDashed,
  Clock,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import type {
  PrCheckRun,
  PrComment,
  PrDetail,
  PrReview,
  PrReviewRequest,
  PullRequestState,
} from '@goodboy/types';
import { groupThreads } from '../comment-threads';
import { latestTerminalReviewsByAuthor } from './latest-terminal-reviews-by-author';

type PrTabKey = 'ci' | 'comments' | 'review';

export type TabStatus = {
  readonly tone: 'success' | 'warning' | 'danger' | 'info' | 'muted';
  readonly icon: ReactNode;
  readonly count?: number;
  readonly label: string;
};

export const computeTabStatus = (
  pr: PullRequestState,
  detail: PrDetail | null,
): Record<PrTabKey, TabStatus | null> => {
  return {
    ci: computeCiStatus(pr, detail?.checks ?? []),
    comments: computeCommentsStatus(detail?.comments ?? []),
    review: computeReviewStatus(pr, detail?.reviews ?? [], detail?.reviewRequests ?? []),
  };
};

const computeCiStatus = (
  pr: PullRequestState,
  checks: ReadonlyArray<PrCheckRun>,
): TabStatus | null => {
  if (checks.length === 0) {
    if (pr.checks === 'failure') {
      return { tone: 'danger', icon: <XCircle size={9} aria-hidden />, label: 'ci failing' };
    }
    if (pr.checks === 'pending') {
      return {
        tone: 'warning',
        icon: <Clock size={9} aria-hidden />,
        label: 'ci running',
      };
    }
    if (pr.checks === 'success') {
      return { tone: 'success', icon: <Check size={9} aria-hidden />, label: 'ci passing' };
    }
    return null;
  }
  const fail = checks.filter(
    (c) =>
      c.conclusion === 'failure' ||
      c.conclusion === 'cancelled' ||
      c.conclusion === 'timed_out' ||
      c.conclusion === 'action_required',
  ).length;
  const pending = checks.filter((c) => c.conclusion === 'pending').length;
  if (fail > 0) {
    return {
      tone: 'danger',
      icon: <XCircle size={9} aria-hidden />,
      count: fail,
      label: `${fail} failing check${fail === 1 ? '' : 's'}`,
    };
  }
  if (pending > 0) {
    return {
      tone: 'warning',
      icon: <Clock size={9} aria-hidden />,
      count: pending,
      label: `${pending} check${pending === 1 ? '' : 's'} running`,
    };
  }
  return { tone: 'success', icon: <Check size={9} aria-hidden />, label: 'all checks passing' };
};

const computeCommentsStatus = (comments: ReadonlyArray<PrComment>): TabStatus | null => {
  const heads = groupThreads(comments)
    .map((t) => t.head)
    .filter((c) => c.source === 'review');
  if (heads.length === 0) {
    return null;
  }
  const open = heads.filter((c) => c.resolved === false).length;
  if (open > 0) {
    return {
      tone: 'warning',
      icon: <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />,
      count: open,
      label: `${open} unresolved comment${open === 1 ? '' : 's'}`,
    };
  }
  return {
    tone: 'success',
    icon: <CheckCheck size={9} aria-hidden />,
    label: 'all comments resolved',
  };
};

const computeReviewStatus = (
  pr: PullRequestState,
  reviews: ReadonlyArray<PrReview>,
  requests: ReadonlyArray<PrReviewRequest>,
): TabStatus | null => {
  const latest = latestTerminalReviewsByAuthor(reviews);
  const changes = latest.filter((r) => r.state === 'changes_requested');
  if (changes.length > 0) {
    return {
      tone: 'danger',
      icon: <AlertCircle size={9} aria-hidden />,
      count: changes.length,
      label: `changes requested by ${changes.map((r) => r.author).join(', ')}`,
    };
  }
  const approvals = latest.filter((r) => r.state === 'approved');
  if (pr.reviewDecision === 'approved' || approvals.length > 0) {
    return {
      tone: 'success',
      icon: <CheckCheck size={9} aria-hidden />,
      label:
        approvals.length > 0
          ? `approved by ${approvals.map((r) => r.author).join(', ')}`
          : 'approved',
    };
  }
  if (requests.length > 0) {
    return {
      tone: 'info',
      icon: <CircleDashed size={9} aria-hidden />,
      count: requests.length,
      label: `awaiting ${requests.length} reviewer${requests.length === 1 ? '' : 's'}`,
    };
  }
  if (reviews.some((r) => r.state === 'commented')) {
    return {
      tone: 'muted',
      icon: <MessageSquare size={9} aria-hidden />,
      label: 'reviewer commented',
    };
  }
  return null;
};
