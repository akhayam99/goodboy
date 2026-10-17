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
      isLive: tally.working > 0,
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
