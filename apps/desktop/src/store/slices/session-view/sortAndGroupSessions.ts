import type {
  Session,
  SessionId,
  SessionPrGroup,
  SessionSortKey,
  SessionStage,
  SessionViewPrefs,
} from '@goodboy/types';
import type { SessionGithubState } from '../../store';
import { PR_GROUP_ORDER, STAGE_ORDER, type GroupedSessions } from './types';

function compareStrLocale(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function sortSessions(sessions: ReadonlyArray<Session>, sort: SessionSortKey): Session[] {
  const copy = [...sessions];
  switch (sort) {
    case 'updatedAt':
      return copy.sort((a, b) => {
        const diff = b.updatedAt.localeCompare(a.updatedAt);
        return diff !== 0 ? diff : b.createdAt.localeCompare(a.createdAt);
      });
    case 'goal':
      return copy.sort((a, b) => {
        const diff = compareStrLocale(a.goal, b.goal);
        return diff !== 0 ? diff : b.updatedAt.localeCompare(a.updatedAt);
      });
    case 'createdAt':
      return copy.sort((a, b) => {
        const diff = a.createdAt.localeCompare(b.createdAt);
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      });
  }
}

function prBucket(github: SessionGithubState | undefined): SessionPrGroup {
  const pr = github?.pr;
  if (!pr) {
    return 'not-open';
  }
  if (pr.state === 'closed') {
    return 'closed';
  }
  if (pr.state === 'merged') {
    return 'merged';
  }
  if (pr.isDraft) {
    return 'draft';
  }
  if (pr.reviewDecision === 'approved') {
    return 'reviewed';
  }
  return 'reviewable';
}

function bucketBy<K extends string>(
  sessions: ReadonlyArray<Session>,
  order: Record<K, number>,
  keyOf: (session: Session) => K,
): ReadonlyArray<GroupedSessions> {
  const buckets = new Map<K, Session[]>();
  for (const s of sessions) {
    const bucket = keyOf(s);
    let arr = buckets.get(bucket);
    if (!arr) {
      arr = [];
      buckets.set(bucket, arr);
    }
    arr.push(s);
  }
  return (Object.keys(order) as K[])
    .filter((k) => buckets.has(k))
    .map((k) => ({ key: k, sessions: buckets.get(k)! }));
}

export const sortAndGroupSessions = (
  sessions: ReadonlyArray<Session>,
  prefs: SessionViewPrefs,
  githubState: Readonly<Record<SessionId, SessionGithubState>>,
  stageBySession: Readonly<Record<SessionId, SessionStage>> = {},
): ReadonlyArray<GroupedSessions> => {
  const sorted = sortSessions(sessions, prefs.sort);

  if (prefs.group === 'none') {
    return [{ key: 'all', sessions: sorted }];
  }

  if (prefs.group === 'stage') {
    return bucketBy(sorted, STAGE_ORDER, (s) => stageBySession[s.id] ?? 'building');
  }

  return bucketBy(sorted, PR_GROUP_ORDER, (s) => prBucket(githubState[s.id]));
};
