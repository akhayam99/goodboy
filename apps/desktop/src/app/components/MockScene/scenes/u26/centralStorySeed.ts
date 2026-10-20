import type { PullRequestChecks } from '@goodboy/types';
import type { BranchPushState } from '../../../../../shared/lib/branchPushState';
import {
  branchFactsOf,
  type BranchFacts,
  type BranchStatusFacts,
} from '../../../../../features/session/central/branches/branchFactsOf';
import {
  aMountRow,
  aRequest,
} from '../../../../../features/session/central/branches/testing/aMountRow';
import type { ActionCardModel } from '../../../../../features/session/central/next/actionCardsOf';
import { aQuestionCard } from '../../../../../features/session/central/now/testing/nowCards';
import { NOW_CLOCK } from '../../../../../features/session/central/now/testing/nowModelOf';

type ReviewDecision = 'approved' | 'changes_requested' | 'review_required' | null;

type RequestSpec = Readonly<{
  number: number;
  isDraft?: boolean;
  state?: 'open' | 'queued' | 'merged' | 'closed';
  isChecksAbsent?: boolean;
  isReviewOptional?: boolean;
  checks?: PullRequestChecks;
  reviewDecision?: ReviewDecision;
  isMergeable?: boolean | null;
}>;

type StorySpec = Readonly<{
  key: string;
  repo: string;
  branch: string;
  request?: RequestSpec;
  push?: BranchPushState;
  ahead?: number;
  changedFiles?: number;
  behind?: number;
  isLive?: boolean;
  card?: string;
  isFinished?: boolean;
}>;

const NINE: ReadonlyArray<StorySpec> = [
  {
    key: 'limit-ledger',
    repo: 'ledger-core',
    branch: 'ak/eng-1191-limit-ledger',
    request: { number: 312, checks: 'failure', reviewDecision: 'review_required' },
    push: { kind: 'in-sync' },
    ahead: 4,
    card: 'Fix checks',
  },
  {
    key: 'payout-caps',
    repo: 'payments-api',
    branch: 'ak/eng-1188-payout-caps',
    request: { number: 308, checks: 'success', reviewDecision: 'approved', isMergeable: false },
    push: { kind: 'in-sync' },
    ahead: 5,
    behind: 6,
    card: 'Rebase',
  },
  {
    key: 'limit-docs',
    repo: 'payments-api',
    branch: 'ak/eng-1193-limit-docs',
    push: { kind: 'in-sync' },
    ahead: 2,
    card: 'Open PR',
  },
  {
    key: 'settlement-view',
    repo: 'ledger-core',
    branch: 'ak/eng-1187-settlement-view',
    request: { number: 311, checks: 'success', reviewDecision: 'approved' },
    push: { kind: 'in-sync' },
    ahead: 3,
    card: 'Merge',
  },
  {
    key: 'tenant-limits',
    repo: 'payments-api',
    branch: 'ak/eng-1190-tenant-limits',
    request: { number: 309, isDraft: true, checks: 'success' },
    push: { kind: 'in-sync' },
    ahead: 5,
    isLive: true,
  },
  {
    key: 'limit-alerts',
    repo: 'notify-relay',
    branch: 'ak/eng-1192-limit-alerts',
    request: { number: 314, checks: 'pending' },
    push: { kind: 'in-sync' },
    ahead: 2,
  },
  {
    key: 'retry-backoff',
    repo: 'notify-relay',
    branch: 'ak/eng-1194-retry-backoff',
    push: { kind: 'not-pushed', commits: 3 },
    ahead: 3,
    card: 'Push',
  },
  {
    key: 'ledger-fixtures',
    repo: 'ledger-core',
    branch: 'ak/eng-1195-ledger-fixtures',
    push: { kind: 'not-pushed', commits: 0 },
    ahead: 0,
    changedFiles: 4,
  },
  {
    key: 'tenant-header',
    repo: 'notify-relay',
    branch: 'ak/eng-1185-tenant-header',
    request: { number: 301, state: 'merged', checks: 'success', reviewDecision: 'approved' },
    isFinished: true,
  },
];

const SKIPPED: ReadonlyArray<StorySpec> = [
  {
    key: 'cache-warmup',
    repo: 'ledger-core',
    branch: 'ak/eng-1210-cache-warmup',
    request: { number: 330, isChecksAbsent: true, isReviewOptional: true },
    push: { kind: 'in-sync' },
    ahead: 2,
  },
  {
    key: 'fx-table',
    repo: 'payments-api',
    branch: 'ak/eng-1211-fx-table',
    request: { number: 331, checks: 'success', isReviewOptional: true },
    push: { kind: 'in-sync' },
    ahead: 3,
  },
  {
    key: 'journal-lock',
    repo: 'ledger-core',
    branch: 'ak/eng-1212-journal-lock',
    request: { number: 332, isChecksAbsent: true, reviewDecision: 'review_required' },
    push: { kind: 'in-sync' },
    ahead: 4,
  },
  {
    key: 'limit-export',
    repo: 'payments-api',
    branch: 'ak/eng-1213-limit-export',
    request: { number: 333, state: 'queued', checks: 'success', reviewDecision: 'approved' },
    push: { kind: 'in-sync' },
    ahead: 2,
  },
  {
    key: 'retry-jitter',
    repo: 'notify-relay',
    branch: 'ak/eng-1214-retry-jitter',
    request: { number: 334 },
    push: { kind: 'in-sync' },
    ahead: 1,
  },
  {
    key: 'digest-copy',
    repo: 'notify-relay',
    branch: 'ak/eng-1215-digest-copy',
    request: { number: 335, checks: 'pending', reviewDecision: 'review_required' },
    push: { kind: 'in-sync' },
    ahead: 2,
  },
  {
    key: 'header-rename',
    repo: 'ledger-core',
    branch: 'ak/eng-1216-header-rename',
    request: { number: 329, state: 'merged', isChecksAbsent: true, isReviewOptional: true },
    isFinished: true,
  },
];

const TOPICS: ReadonlyArray<string> = [
  'rate-window',
  'burst-guard',
  'audit-trail',
  'retry-queue',
  'tenant-flags',
  'payout-export',
  'webhook-sign',
  'limit-banner',
  'ledger-index',
  'sandbox-keys',
  'daily-rollup',
];

const REPOS: ReadonlyArray<string> = ['payments-api', 'ledger-core', 'notify-relay'];

type ExtraParams = {
  readonly index: number;
};

const extraOf = ({ index }: ExtraParams): StorySpec => {
  const topic = TOPICS[index % TOPICS.length] ?? 'misc';
  const repo = REPOS[index % REPOS.length] ?? 'payments-api';
  const base = {
    key: `extra-${index}`,
    repo,
    branch: `ak/eng-12${String(index).padStart(2, '0')}-${topic}`,
  };
  switch (index % 4) {
    case 0:
      return {
        ...base,
        request: { number: 320 + index, checks: 'success', reviewDecision: 'review_required' },
        push: { kind: 'in-sync' },
        ahead: 2,
      };
    case 1:
      return { ...base, push: { kind: 'not-pushed', commits: 2 }, ahead: 2 };
    case 2:
      return {
        ...base,
        request: { number: 320 + index, state: 'merged', checks: 'success' },
        isFinished: true,
      };
    default:
      return {
        ...base,
        request: { number: 320 + index, isDraft: true, checks: 'pending' },
        push: { kind: 'in-sync' },
        ahead: 1,
      };
  }
};

type StoryParams = {
  readonly count: 7 | 9 | 20;
  readonly repo: string | null;
};

export type CentralStorySeed = Readonly<{
  facts: ReadonlyArray<BranchFacts>;
  cards: ReadonlyArray<ActionCardModel>;
}>;

const MINUTE_MS = 60_000;

export const centralStorySeedOf = ({ count, repo }: StoryParams): CentralStorySeed => {
  const specs =
    count === 7
      ? SKIPPED
      : count === 9
        ? NINE
        : [
            ...NINE,
            ...Array.from({ length: count - NINE.length }, (_, index) => extraOf({ index })),
          ];
  const rows = specs.map((spec) => ({
    ...aMountRow({
      key: spec.key,
      projectName: repo ?? spec.repo,
      branch: spec.branch,
      request:
        spec.request === undefined
          ? null
          : aRequest({
              provider: 'github',
              number: spec.request.number,
              state: spec.request.state ?? 'open',
              isDraft: spec.request.isDraft ?? false,
              checks: spec.request.checks ?? null,
              reviewDecision: spec.request.reviewDecision ?? null,
              isMergeable: spec.request.isMergeable ?? null,
              isChecksAbsent: spec.request.isChecksAbsent,
              isReviewOptional: spec.request.isReviewOptional,
            }),
    }),
    isFinished: spec.isFinished ?? false,
  }));
  const fresh = new Date(NOW_CLOCK - 2 * MINUTE_MS).toISOString();
  const statusByMountId = new Map<string, BranchStatusFacts>();
  const behindByMountId = new Map<string, number | null>();
  const liveCountByMountId = new Map<string, number>();
  const liveTitleByMountId = new Map<string, string>();
  const cards: Array<ActionCardModel> = [];
  specs.forEach((spec, index) => {
    const row = rows[index];
    if (row === undefined) {
      return;
    }
    if (spec.push !== undefined) {
      statusByMountId.set(row.mountId, {
        ahead: spec.ahead ?? 0,
        push: spec.push,
        changedFiles: spec.changedFiles ?? 0,
        isRebasing: false,
      });
    }
    behindByMountId.set(row.mountId, spec.behind ?? 0);
    if (spec.isLive === true) {
      liveCountByMountId.set(row.mountId, 1);
      liveTitleByMountId.set(row.mountId, 'Implementer');
    }
    if (spec.card !== undefined) {
      cards.push({
        ...aQuestionCard({ where: spec.branch }),
        id: `card:${spec.key}`,
        title: spec.card,
        mountId: row.mountId,
      });
    }
  });
  return {
    facts: branchFactsOf({
      rows,
      fetchedAtByMountId: new Map(rows.map((row) => [row.mountId, fresh])),
      behindByMountId,
      liveCountByMountId,
      liveTitleByMountId,
      statusByMountId,
      now: NOW_CLOCK,
    }),
    cards,
  };
};
