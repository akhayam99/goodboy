import type { Session, SessionId } from '@goodboy/types';
import type { StartSessionFromDraftParams } from '../../store/slices/sessionDraft/startSessionFromDraft';
import { draftGoalText } from '../../store/slices/sessionDraft/draftGoalText';
import type { AgentKindRouting } from '../session/agent-kind';
import { shapeRouteOf } from '../session/startRun/routeChoiceOf';
import type { RunRouteResult } from '../session/startRun/runRouteOf';
import { startRoutedRun } from '../session/startRun/startRoutedRun';
import { startWorkKeyOf, type StartWorkTarget } from './startWorkTarget';

const ROUTE_ROW = 1;

const ROUTE_WHY = 'You started it from Start work.';

const MOUNT_REASON = 'Picked in Start work.';

type Params = {
  readonly target: StartWorkTarget;
  readonly text: string;
  readonly routing: AgentKindRouting | null;
  readonly startFromDraft: (params: StartSessionFromDraftParams) => Promise<Session>;
};

type RunParams = {
  readonly sessionId: SessionId;
};

export type StartedWork = Readonly<{
  sessionId: SessionId;
}>;

const inFlight = new Map<string, Promise<StartedWork>>();

const write = async ({ target, text, routing, startFromDraft }: Params): Promise<StartedWork> => {
  const asked = text.trim();
  const ask =
    target.sessionId !== null && target.branch !== null
      ? `${asked}\n\nWork on the branch ${target.branch}.`
      : asked;
  const result: RunRouteResult = {
    route: shapeRouteOf({ shape: 'lead', row: ROUTE_ROW, why: ROUTE_WHY }),
    ask,
    preset: null,
    role: null,
  };
  const run = async ({ sessionId }: RunParams): Promise<void> => {
    await startRoutedRun({ sessionId, result, ...(routing !== null && { routing }) });
  };
  if (target.sessionId !== null) {
    await run({ sessionId: target.sessionId });
    return { sessionId: target.sessionId };
  }
  const { branch, projectId } = target;
  const created = await startFromDraft({
    workspaceId: target.workspaceId,
    start: {
      kind: 'task',
      candidates: [],
      title: draftGoalText({ text: ask }),
      goal: ask,
      then: { kind: 'workflow-run', run: ({ id }: Session) => run({ sessionId: id }) },
      ...(projectId !== null && { mount: { projectId, reason: MOUNT_REASON } }),
      ...(branch !== null && { checkout: { existingBranch: branch, fallbackRef: branch } }),
    },
  });
  return { sessionId: created.id };
};

export const startWorkRun = ({
  target,
  text,
  routing,
  startFromDraft,
}: Params): Promise<StartedWork> => {
  const key = startWorkKeyOf({ target });
  const running = inFlight.get(key);
  if (running !== undefined) {
    return running;
  }
  const started = write({ target, text, routing, startFromDraft }).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, started);
  return started;
};
