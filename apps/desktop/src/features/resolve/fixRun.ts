import type { AgentId, ResolveAttempt } from '@goodboy/types';
import { modelLabel } from '../chat/utils/chat-constants';
import { launchKeyOf } from '../../store/slices/resolve/resolveLaunch';
import type { ResolveWord } from './commentProjection';
import { reviewTallyOfWords, type ReviewTally } from './reviewTally';

export type FixRunSource = {
  readonly threadId: string;
  readonly word: ResolveWord;
  readonly attempt: ResolveAttempt | null;
};

export type FixRun = {
  readonly launchId: string;
  readonly agentId: AgentId;
  readonly attempt: ResolveAttempt;
  readonly threadIds: ReadonlyArray<string>;
  readonly total: number;
  readonly tally: ReviewTally;
  readonly isLive: boolean;
  readonly model: string;
};

export type FixRunChipKey =
  'needs_you' | 'working' | 'ready_to_push' | 'push_failed' | 'couldnt_fix';

type FixRunChip = {
  readonly key: FixRunChipKey;
  readonly phrase: string;
  readonly countOf: (tally: ReviewTally) => number;
};

export const FIX_RUN_CHIPS: ReadonlyArray<FixRunChip> = [
  { key: 'needs_you', phrase: 'need you', countOf: (tally) => tally.needsYou },
  { key: 'working', phrase: 'working', countOf: (tally) => tally.working },
  { key: 'ready_to_push', phrase: 'ready to push', countOf: (tally) => tally.readyToPush },
  { key: 'push_failed', phrase: 'push failed', countOf: (tally) => tally.pushFailed },
  { key: 'couldnt_fix', phrase: "couldn't fix", countOf: (tally) => tally.couldntFix },
];

export const FIX_RUN_CHIP_WORDS: Readonly<Record<FixRunChipKey, ReadonlyArray<ResolveWord>>> = {
  needs_you: ['question', 'push_failed', 'to_review', 'couldnt_fix'],
  working: ['working'],
  ready_to_push: ['ready'],
  push_failed: ['push_failed'],
  couldnt_fix: ['couldnt_fix'],
};

const capitalized = ({ text }: { readonly text: string }): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const fixRunModelLabel = ({ attempt }: { readonly attempt: ResolveAttempt }): string =>
  attempt.effort === null
    ? modelLabel(attempt.model)
    : `${modelLabel(attempt.model)} · ${capitalized({ text: attempt.effort })}`;

const isShown = ({ tally }: { readonly tally: ReviewTally }): boolean =>
  tally.working + tally.needsYou + tally.readyToPush > 0;

export const fixRunOf = ({
  sources,
}: {
  readonly sources: ReadonlyArray<FixRunSource>;
}): FixRun | null => {
  const byLaunch = new Map<string, Array<FixRunSource & { readonly attempt: ResolveAttempt }>>();
  for (const source of sources) {
    if (source.attempt === null) {
      continue;
    }
    const key = launchKeyOf({ attempt: source.attempt });
    byLaunch.set(key, [...(byLaunch.get(key) ?? []), { ...source, attempt: source.attempt }]);
  }
  let latest: FixRun | null = null;
  let latestAt = -1;
  for (const [launchId, members] of byLaunch) {
    const newest = members.reduce((first, member) =>
      member.attempt.createdAt >= first.attempt.createdAt ? member : first,
    );
    const tally = reviewTallyOfWords({ words: members.map((member) => member.word) });
    if (!isShown({ tally }) || newest.attempt.createdAt < latestAt) {
      continue;
    }
    latestAt = newest.attempt.createdAt;
    latest = {
      launchId,
      agentId: newest.attempt.agentId,
      attempt: newest.attempt,
      threadIds: members.map((member) => member.threadId),
      total: members.length,
      tally,
      isLive: tally.working + tally.question > 0,
      model: fixRunModelLabel({ attempt: newest.attempt }),
    };
  }
  return latest;
};

export const fixRunLabel = ({
  total,
  prNumber,
}: {
  readonly total: number;
  readonly prNumber: number | null;
}): string => {
  const comments = total === 1 ? '1 comment' : `${total} comments`;
  return prNumber === null ? `Fix run · ${comments}` : `Fix run · #${prNumber} · ${comments}`;
};

const WORD_PRECEDENCE: ReadonlyArray<ResolveWord> = [
  'question',
  'working',
  'push_failed',
  'to_review',
  'couldnt_fix',
  'ready',
  'done',
  'left_open',
  'open',
];

export const fixRunWordOf = ({
  words,
}: {
  readonly words: ReadonlyArray<ResolveWord>;
}): ResolveWord => WORD_PRECEDENCE.find((word) => words.includes(word)) ?? 'done';

export const fixRunThreadIdsOf = ({
  attempts,
  agentId,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly agentId: AgentId;
}): ReadonlyArray<string> => [
  ...new Set(
    attempts
      .filter((attempt) => attempt.agentId === agentId)
      .flatMap((attempt) => attempt.threadIds),
  ),
];

export const fixRunNameOf = ({
  attempts,
  agentId,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly agentId: AgentId;
}): string | null => {
  const latest = attempts
    .filter((attempt) => attempt.agentId === agentId)
    .reduce<ResolveAttempt | null>(
      (newest, attempt) =>
        newest === null || attempt.createdAt >= newest.createdAt ? attempt : newest,
      null,
    );
  if (latest === null) {
    return null;
  }
  return fixRunLabel({
    total: fixRunThreadIdsOf({ attempts, agentId }).length,
    prNumber: latest.prNumber,
  });
};

export const fixRunTitle = ({
  run,
  noun = 'comment',
}: {
  readonly run: FixRun;
  readonly noun?: 'comment' | 'note';
}): string => {
  const counted = run.total === 1 ? `1 ${noun}` : `${run.total} ${noun}s`;
  return run.isLive ? `Fixing ${counted}` : `Fix run · ${counted}`;
};
