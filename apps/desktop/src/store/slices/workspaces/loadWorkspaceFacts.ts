import type { Agent, OpenQuestion, SessionId } from '@goodboy/types';
import {
  listAutoTreesToRecover,
  listDecidedNudgeEventsForSessions,
  listOpenQuestionsForSessions,
  type Database,
} from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { autoRootsOf } from '../../../features/auto/autoRootsOf';
import type { AgentKind } from '../../../features/session/agent-kind';
import { dismissedFingerprintsFromEvents } from '../../../features/suggestions/nextStepOutcomes';
import { readAutoTreeViews } from '../auto-view/readAutoTreeViews';
import type { AutoTreeView } from '../auto-view/state';

export type WorkspaceFacts = Readonly<{
  sessionOpenQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>> | null;
  sessionDismissedNextSteps: Readonly<Record<SessionId, ReadonlySet<string>>> | null;
  autoTreeViews: Readonly<Record<SessionId, ReadonlyArray<AutoTreeView>>> | null;
  error: string | null;
}>;

type Params = {
  readonly db: Database;
  readonly sessionIds: ReadonlyArray<SessionId>;
  readonly sessionPhaseRuns: Readonly<Record<string, ReadonlyArray<Agent>>>;
  readonly kindOverride: Readonly<Record<string, AgentKind>>;
};

type AutoViewsRead = Readonly<{
  views: Readonly<Record<SessionId, ReadonlyArray<AutoTreeView>>>;
  failure: unknown;
}>;

type ReadAutoViewsParams = {
  readonly db: Database;
  readonly sessionIds: ReadonlyArray<SessionId>;
};

const readMovingAutoViews = async ({
  db,
  sessionIds,
}: ReadAutoViewsParams): Promise<AutoViewsRead> => {
  if (sessionIds.length === 0) {
    return { views: {}, failure: null };
  }
  const wanted = new Set<string>(sessionIds);
  const moving = new Set(
    (await listAutoTreesToRecover({ db }))
      .map((tree) => tree.sessionId)
      .filter((sessionId) => wanted.has(sessionId)),
  );
  const settled = await Promise.allSettled(
    [...moving].map(
      async (sessionId) => [sessionId, await readAutoTreeViews({ db, sessionId })] as const,
    ),
  );
  const failed = settled.find((result) => result.status === 'rejected');
  const resting = sessionIds
    .filter((sessionId) => !moving.has(sessionId))
    .map((sessionId) => [sessionId, [] as ReadonlyArray<AutoTreeView>] as const);
  return {
    views: Object.fromEntries([
      ...resting,
      ...settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
    ]),
    failure: failed === undefined ? null : failed.reason,
  };
};

export const loadWorkspaceFacts = async ({
  db,
  sessionIds,
  sessionPhaseRuns,
  kindOverride,
}: Params): Promise<WorkspaceFacts> => {
  const autoSessionIds = sessionIds.filter(
    (sessionId) =>
      autoRootsOf({ agents: sessionPhaseRuns[sessionId] ?? [], kindOverride }).length > 0,
  );
  const [questions, nudges, autoViews] = await Promise.allSettled([
    listOpenQuestionsForSessions({ db, sessionIds }),
    listDecidedNudgeEventsForSessions({ db, sessionIds }),
    readMovingAutoViews({ db, sessionIds: autoSessionIds }),
  ]);
  const failures = [
    questions.status === 'rejected' ? questions.reason : null,
    nudges.status === 'rejected' ? nudges.reason : null,
    autoViews.status === 'rejected' ? autoViews.reason : autoViews.value.failure,
  ].filter((failure) => failure != null);
  return {
    sessionOpenQuestions:
      questions.status === 'rejected'
        ? null
        : Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              questions.value.filter((question) => question.sessionId === sessionId),
            ]),
          ),
    sessionDismissedNextSteps:
      nudges.status === 'rejected'
        ? null
        : Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              dismissedFingerprintsFromEvents({
                events: nudges.value.filter((event) => event.sessionId === sessionId),
              }),
            ]),
          ),
    autoTreeViews: autoViews.status === 'rejected' ? null : autoViews.value.views,
    error: failures.length === 0 ? null : formatError(failures[0]),
  };
};
