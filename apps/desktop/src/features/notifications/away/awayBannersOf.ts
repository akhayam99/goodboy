import type { SessionAttentionReason, SessionId } from '@goodboy/types';

const GROUP_AT = 3;

export type BannerCandidate = {
  readonly key: string;
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason;
  readonly title: string;
  readonly body: string;
};

export type AwayBanner = {
  readonly sessionId: SessionId | null;
  readonly reason: SessionAttentionReason | null;
  readonly title: string;
  readonly body: string;
  readonly keys: ReadonlyArray<string>;
};

type Params = {
  readonly previousKeys: ReadonlySet<string>;
  readonly candidates: ReadonlyArray<BannerCandidate>;
  readonly recentCount: number;
  readonly workspaceName: string;
};

type CountParams = {
  readonly count: number;
};

const groupedBodyOf = ({ count }: CountParams): string => `${count} sessions need you`;

export const awayBannersOf = ({
  previousKeys,
  candidates,
  recentCount,
  workspaceName,
}: Params): ReadonlyArray<AwayBanner> => {
  const fresh = candidates.filter((candidate) => !previousKeys.has(candidate.key));
  if (fresh.length === 0) {
    return [];
  }
  const total = recentCount + fresh.length;
  if (total >= GROUP_AT) {
    return [
      {
        sessionId: null,
        reason: null,
        title: workspaceName,
        body: groupedBodyOf({ count: total }),
        keys: fresh.map((candidate) => candidate.key),
      },
    ];
  }
  return fresh.map((candidate) => ({
    sessionId: candidate.sessionId,
    reason: candidate.reason,
    title: candidate.title,
    body: candidate.body,
    keys: [candidate.key],
  }));
};
