import type {
  Session,
  SessionId,
  SessionPrGroup,
  SessionSortKey,
  SessionUserStatus,
  SessionUserStatusGroup,
  SessionViewPrefs,
} from '@goodboy/types';
import type { SessionGithubState } from '../../store';
import { PR_GROUP_ORDER, USER_STATUS_ORDER, type GroupedSessions } from './types';

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

function userStatusBucket(status: SessionUserStatus): SessionUserStatusGroup {
  switch (status) {
    case 'wip':
      return 'wip';
    case 'waiting':
      return 'waiting';
    case 'blocked':
      return 'blocked';
    case 'done':
      return 'done';
  }
}

function prBucket(github: SessionGithubState | undefined): SessionPrGroup {
  const pr = github?.pr;
  if (!pr) return 'not-open';
  if (pr.state === 'closed') return 'closed';
  if (pr.state === 'merged') return 'merged';
  if (pr.isDraft) return 'draft';
  if (pr.reviewDecision === 'approved') return 'reviewed';
  return 'reviewable';
}

export function sortAndGroupSessions(
  sessions: ReadonlyArray<Session>,
  prefs: SessionViewPrefs,
  githubState: Readonly<Record<SessionId, SessionGithubState>>,
): ReadonlyArray<GroupedSessions> {
  const sorted = sortSessions(sessions, prefs.sort);

  if (prefs.group === 'none') {
    return [{ key: 'all', sessions: sorted }];
  }

  if (prefs.group === 'userStatus') {
    const buckets = new Map<SessionUserStatusGroup, Session[]>();
    for (const s of sorted) {
      const bucket = userStatusBucket(s.userStatus);
      let arr = buckets.get(bucket);
      if (!arr) {
        arr = [];
        buckets.set(bucket, arr);
      }
      arr.push(s);
    }
    return (Object.keys(USER_STATUS_ORDER) as SessionUserStatusGroup[])
      .filter((k) => buckets.has(k))
      .map((k) => ({ key: k, sessions: buckets.get(k)! }));
  }

  const buckets = new Map<SessionPrGroup, Session[]>();
  for (const s of sorted) {
    const bucket = prBucket(githubState[s.id]);
    let arr = buckets.get(bucket);
    if (!arr) {
      arr = [];
      buckets.set(bucket, arr);
    }
    arr.push(s);
  }
  return (Object.keys(PR_GROUP_ORDER) as SessionPrGroup[])
    .filter((k) => buckets.has(k))
    .map((k) => ({ key: k, sessions: buckets.get(k)! }));
}
