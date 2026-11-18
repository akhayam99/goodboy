import type { Session, TurnState } from '@goodboy/types';
import { latestStampMs } from './latestStampMs';

type StateParams = {
  readonly state: TurnState;
};

const stateStampOf = ({ state }: StateParams): string | null => {
  switch (state.kind) {
    case 'draft':
      return null;
    case 'starting':
    case 'running':
      return state.startedAt;
    case 'idle':
      return state.lastActivityAt;
    case 'blocked':
      return state.blockedAt;
    case 'error':
      return state.failedAt;
    case 'ended':
      return state.endedAt;
  }
};

type ActivityParams = {
  readonly session: Session;
  readonly seenActivityAt: number | null;
};

export const sessionLastActivityMs = ({ session, seenActivityAt }: ActivityParams): number | null =>
  latestStampMs({
    stamps: [
      session.createdAt,
      session.updatedAt,
      session.lastOpenedAt,
      stateStampOf({ state: session.state }),
      ...session.workflowRuns.flatMap((run) => [
        run.createdAt,
        ...(run.orchestratorHints ?? []).map((hint) => hint.createdAt),
      ]),
      seenActivityAt,
    ],
  });
