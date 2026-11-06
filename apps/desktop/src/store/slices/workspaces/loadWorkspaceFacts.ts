import type { Agent, OpenQuestion, SessionId } from '@goodboy/types';
import {
  listDecidedNudgeEventsForSessions,
  listOpenQuestionsForSessions,
  type Database,
} from '@goodboy/db';
import { autoRootsOf } from '../../../features/auto/autoRootsOf';
import type { AgentKind } from '../../../features/session/agent-kind';
import { dismissedFingerprintsFromEvents } from '../../../features/suggestions/nextStepOutcomes';
import { readAutoTreeViews } from '../auto-view/readAutoTreeViews';
import type { AutoTreeView } from '../auto-view/state';

export type WorkspaceFacts = Readonly<{
  sessionOpenQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  sessionDismissedNextSteps: Readonly<Record<SessionId, ReadonlySet<string>>>;
  autoTreeViews: Readonly<Record<SessionId, ReadonlyArray<AutoTreeView>>>;
}>;

type Params = {
  readonly db: Database;
  readonly sessionIds: ReadonlyArray<SessionId>;
  readonly sessionPhaseRuns: Readonly<Record<string, ReadonlyArray<Agent>>>;
  readonly kindOverride: Readonly<Record<string, AgentKind>>;
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
  const [questions, nudges, autoViews] = await Promise.all([
    listOpenQuestionsForSessions({ db, sessionIds }),
    listDecidedNudgeEventsForSessions({ db, sessionIds }),
    Promise.all(
      autoSessionIds.map(
        async (sessionId) => [sessionId, await readAutoTreeViews({ db, sessionId })] as const,
      ),
    ),
  ]);
  return {
    sessionOpenQuestions: Object.fromEntries(
      sessionIds.map((sessionId) => [
        sessionId,
        questions.filter((question) => question.sessionId === sessionId),
      ]),
    ),
    sessionDismissedNextSteps: Object.fromEntries(
      sessionIds.map((sessionId) => [
        sessionId,
        dismissedFingerprintsFromEvents({
          events: nudges.filter((event) => event.sessionId === sessionId),
        }),
      ]),
    ),
    autoTreeViews: Object.fromEntries(autoViews),
  };
};
