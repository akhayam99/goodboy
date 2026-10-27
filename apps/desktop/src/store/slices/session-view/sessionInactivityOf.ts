import type { Session, SessionStageInfo, TurnState } from '@goodboy/types';
import { latestStampMs } from './latestStampMs';
import { INACTIVE_AFTER_MS, RECENTLY_OPENED_MS } from './types';

type InactivityStageInfo = Pick<
  SessionStageInfo,
  'stage' | 'attention' | 'otherReasons' | 'prState'
> & {
  readonly isRunning?: boolean;
};

export type SessionInactivity = {
  readonly isInactive: boolean;
  readonly lastActivityAt: number | null;
};

type Params = {
  readonly session: Session;
  readonly info: InactivityStageInfo;
  readonly now: number;
  readonly isPinned: boolean;
  readonly isCurrent: boolean;
  readonly isQueued: boolean;
  readonly hasDraft: boolean;
  readonly seenActivityAt: number | null;
  readonly requestEndedAt?: number | null;
  readonly personTurnAt?: number | null;
};

type StateParams = {
  readonly state: TurnState;
};

type QuietParams = {
  readonly info: InactivityStageInfo;
};

const LIVE_STATES: ReadonlyArray<TurnState['kind']> = ['starting', 'running', 'blocked', 'error'];

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

const RESUME_GRACE_MS = 5 * 60_000;

type SettledParams = {
  readonly info: InactivityStageInfo;
  readonly requestEndedAt: number | null;
  readonly personTurnAt: number | null;
};

const isSettledByRequest = ({ info, requestEndedAt, personTurnAt }: SettledParams): boolean =>
  info.stage === 'done' &&
  (info.prState === 'merged' || info.prState === 'closed') &&
  requestEndedAt !== null &&
  (personTurnAt === null || personTurnAt <= requestEndedAt + RESUME_GRACE_MS);

const isQuiet = ({ info }: QuietParams): boolean =>
  info.stage !== 'attention' &&
  info.stage !== 'running' &&
  info.isRunning !== true &&
  info.attention === null &&
  (info.otherReasons ?? []).length === 0;

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

export const sessionInactivityOf = ({
  session,
  info,
  now,
  isPinned,
  isCurrent,
  isQueued,
  hasDraft,
  seenActivityAt,
  requestEndedAt = null,
  personTurnAt = null,
}: Params): SessionInactivity => {
  const openedAt = latestStampMs({ stamps: [session.lastOpenedAt] });
  const lastActivityAt = sessionLastActivityMs({ session, seenActivityAt });
  const active: SessionInactivity = { isInactive: false, lastActivityAt };
  if (isPinned || isCurrent || isQueued || hasDraft) {
    return active;
  }
  if (LIVE_STATES.includes(session.state.kind) || !isQuiet({ info })) {
    return active;
  }
  if (openedAt !== null && now - openedAt <= RECENTLY_OPENED_MS) {
    return active;
  }
  if (isSettledByRequest({ info, requestEndedAt, personTurnAt })) {
    return { isInactive: true, lastActivityAt };
  }
  if (lastActivityAt === null || now - lastActivityAt <= INACTIVE_AFTER_MS) {
    return active;
  }
  return { isInactive: true, lastActivityAt };
};
