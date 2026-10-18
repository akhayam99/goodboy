import type {
  Session,
  SessionId,
  SessionSortKey,
  SessionStage,
  SessionViewPrefs,
} from '@goodboy/types';
import type { SessionGithubState } from '../../types';
import {
  LIST_STAGE_ORDER,
  NO_PROJECT_GROUP_KEY,
  PR_GROUP_ORDER,
  type GroupedSessions,
  type SessionProjectRef,
} from './types';
import { pullRequestGroupOf } from './pullRequestGroup';

type Compare = (a: Session, b: Session) => number;

type LastTurnBySession = Readonly<Record<string, string>>;

type SortParams = {
  readonly sessions: ReadonlyArray<Session>;
  readonly sort: SessionSortKey;
  readonly stageBySession: Readonly<Record<SessionId, SessionStage>>;
  readonly lastTurnBySession: LastTurnBySession;
};

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly prefs: SessionViewPrefs;
  readonly githubState: Readonly<Record<SessionId, SessionGithubState>>;
  readonly stageBySession?: Readonly<Record<SessionId, SessionStage>>;
  readonly projectBySession?: Readonly<Record<SessionId, SessionProjectRef | null>>;
  readonly lastTurnBySession?: LastTurnBySession;
};

type ActivityKeyParams = {
  readonly session: Session;
  readonly lastTurnBySession: LastTurnBySession;
};

const activityKeyOf = ({ session, lastTurnBySession }: ActivityKeyParams): string => {
  const lastTurn = lastTurnBySession[session.id];
  return lastTurn !== undefined && lastTurn > session.updatedAt ? lastTurn : session.updatedAt;
};

const compareText = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

const compareIso = (a: string, b: string): number => a.localeCompare(b);

const firstDifference = ({ results }: { readonly results: ReadonlyArray<number> }): number =>
  results.find((result) => result !== 0) ?? 0;

const byId: Compare = (a, b) => a.id.localeCompare(b.id);

const openedKeyOf = (session: Session): string => session.lastOpenedAt ?? session.updatedAt;

const byOpenedDesc: Compare = (a, b) =>
  firstDifference({
    results: [
      compareIso(openedKeyOf(b), openedKeyOf(a)),
      compareIso(b.createdAt, a.createdAt),
      byId(a, b),
    ],
  });

type ActivityCompareParams = {
  readonly lastTurnBySession: LastTurnBySession;
};

const byActivityDesc =
  ({ lastTurnBySession }: ActivityCompareParams): Compare =>
  (a, b) =>
    firstDifference({
      results: [
        compareIso(
          activityKeyOf({ session: b, lastTurnBySession }),
          activityKeyOf({ session: a, lastTurnBySession }),
        ),
        compareIso(b.createdAt, a.createdAt),
        byId(a, b),
      ],
    });

const byWaitingSinceAsc: Compare = (a, b) =>
  firstDifference({
    results: [
      compareIso(a.updatedAt, b.updatedAt),
      compareIso(a.createdAt, b.createdAt),
      byId(a, b),
    ],
  });

const byUpdatedDesc: Compare = (a, b) =>
  firstDifference({
    results: [
      compareIso(b.updatedAt, a.updatedAt),
      compareIso(b.createdAt, a.createdAt),
      byId(a, b),
    ],
  });

const byGoal: Compare = (a, b) =>
  firstDifference({
    results: [compareText(a.goal, b.goal), compareIso(b.updatedAt, a.updatedAt), byId(a, b)],
  });

const byCreatedDesc: Compare = (a, b) =>
  firstDifference({ results: [compareIso(b.createdAt, a.createdAt), byId(a, b)] });

export const recentlyOpenedFirst = (sessions: ReadonlyArray<Session>): Session[] =>
  [...sessions].sort(byOpenedDesc);

const sortNeedsYouFirst = ({
  sessions,
  stageBySession,
  lastTurnBySession,
}: Omit<SortParams, 'sort'>): Session[] => {
  const needs = sessions.filter((session) => stageBySession[session.id] === 'attention');
  const rest = sessions.filter((session) => stageBySession[session.id] !== 'attention');
  return [...needs.sort(byWaitingSinceAsc), ...rest.sort(byActivityDesc({ lastTurnBySession }))];
};

const sortSessions = ({
  sessions,
  sort,
  stageBySession,
  lastTurnBySession,
}: SortParams): Session[] => {
  switch (sort) {
    case 'needsYou':
      return sortNeedsYouFirst({ sessions, stageBySession, lastTurnBySession });
    case 'updatedAt':
      return [...sessions].sort(byUpdatedDesc);
    case 'goal':
      return [...sessions].sort(byGoal);
    case 'createdAt':
      return [...sessions].sort(byCreatedDesc);
  }
};

type BucketParams<K extends string> = {
  readonly sessions: ReadonlyArray<Session>;
  readonly order: Record<K, number>;
  readonly keyOf: (session: Session) => K;
};

const bucketBy = <K extends string>({
  sessions,
  order,
  keyOf,
}: BucketParams<K>): ReadonlyArray<GroupedSessions> => {
  const buckets = new Map<K, Session[]>();
  for (const session of sessions) {
    const key = keyOf(session);
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, [session]);
      continue;
    }
    bucket.push(session);
  }
  return (Object.keys(order) as K[]).flatMap((key) => {
    const bucket = buckets.get(key);
    return bucket === undefined ? [] : [{ key, sessions: bucket }];
  });
};

type ProjectBucketParams = {
  readonly sessions: ReadonlyArray<Session>;
  readonly projectBySession: Readonly<Record<SessionId, SessionProjectRef | null>>;
};

const bucketByProject = ({
  sessions,
  projectBySession,
}: ProjectBucketParams): ReadonlyArray<GroupedSessions> => {
  const buckets = new Map<string, { label: string; sessions: Session[] }>();
  for (const session of sessions) {
    const project = projectBySession[session.id] ?? null;
    const key = project === null ? NO_PROJECT_GROUP_KEY : project.id;
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, {
        label: project === null ? 'No folder' : project.name,
        sessions: [session],
      });
      continue;
    }
    bucket.sessions.push(session);
  }
  return [...buckets.entries()]
    .sort(([keyA, a], [keyB, b]) => {
      if (keyA === NO_PROJECT_GROUP_KEY || keyB === NO_PROJECT_GROUP_KEY) {
        return Number(keyA === NO_PROJECT_GROUP_KEY) - Number(keyB === NO_PROJECT_GROUP_KEY);
      }
      return compareText(a.label, b.label);
    })
    .map(([key, bucket]) => ({ key, label: bucket.label, sessions: bucket.sessions }));
};

export const sortAndGroupSessions = ({
  sessions,
  prefs,
  githubState,
  stageBySession = {},
  projectBySession = {},
  lastTurnBySession = {},
}: Params): ReadonlyArray<GroupedSessions> => {
  const sorted = sortSessions({ sessions, sort: prefs.sort, stageBySession, lastTurnBySession });

  switch (prefs.group) {
    case 'none':
      return [{ key: 'all', sessions: sorted }];
    case 'stage':
      return bucketBy({
        sessions: sorted,
        order: LIST_STAGE_ORDER,
        keyOf: (session) => stageBySession[session.id] ?? 'building',
      });
    case 'pr':
      return bucketBy({
        sessions: sorted,
        order: PR_GROUP_ORDER,
        keyOf: (session) => pullRequestGroupOf({ pr: githubState[session.id]?.pr }),
      });
    case 'project':
      return bucketByProject({ sessions: sorted, projectBySession });
  }
};
