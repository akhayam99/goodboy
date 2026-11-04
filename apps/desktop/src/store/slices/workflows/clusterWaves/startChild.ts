import { formatError } from '@goodboy/ui';
import type { AgentId, HandoffDraft, SessionId } from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { isAgentStatusSettled } from '@goodboy/core/workflows';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../../features/workflows/workflows';
import { sessionById } from '../../sessions/sessionIndex';
import type { GetFn, SetFn } from '../types';
import { clusterLaunching } from './clusterLaunching';

const MAX_START_ATTEMPTS = 3;

const MAX_STEP_START_ATTEMPTS = 6;

const START_BACKOFF_MS: ReadonlyArray<number> = [2_000, 8_000];

const DETERMINISTIC_START_FAILURES: ReadonlyArray<RegExp> = [
  /session not found/i,
  /no agent selected/i,
  /session directory not found/i,
  /resolved model args omit/i,
  /agent not found/i,
];

type FailureParams = {
  readonly error: unknown;
};

const isTransientStartFailure = ({ error }: FailureParams): boolean => {
  const message = formatError(error);
  return !DETERMINISTIC_START_FAILURES.some((pattern) => pattern.test(message));
};

type WorkParams = {
  readonly get: GetFn;
  readonly childId: AgentId;
};

const producedWork = ({ get, childId }: WorkParams): boolean =>
  (get().transcripts[childId] ?? []).some(
    (event) => event.kind === 'assistant_text' || event.kind === 'tool_call_start',
  );

type StartChildParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly containerId: AgentId;
  readonly childId: AgentId;
  readonly content: string;
  readonly handoff?: HandoffDraft;
  readonly attempt?: number;
};

type HandleParams = StartChildParams & FailureParams;

type FailParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly childId: AgentId;
  readonly reason: string;
};

const failChildStart = async ({
  set,
  get,
  sessionId,
  childId,
  reason,
}: FailParams): Promise<void> => {
  const name =
    (get().sessionPhaseRuns[sessionId] ?? []).find((r) => r.id === childId)?.name ?? 'cluster';
  clusterLaunching.release({ childId });
  let writeFailure = '';
  try {
    await invokeAgentUpdateStatus(childId, { status: 'failed', completedAt: isoNow() });
    const refreshed = await invokeAgentList(sessionId);
    set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
  } catch (error) {
    writeFailure = ` it could not be marked failed: ${formatError(error)}.`;
  }
  void get().refreshUnreadWorkspaces();
  void get().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: `Subagent ${name} couldn't start`,
    body: `${reason} open the agent and continue it manually. the step stays open until this subagent finishes.${writeFailure}`,
    sessionId,
  });
};

const handleChildStartFailure = async ({
  set,
  get,
  sessionId,
  containerId,
  childId,
  content,
  handoff,
  error,
}: HandleParams): Promise<void> => {
  const message = formatError(error);
  const failures = get().clusterStartAttempts[childId] ?? 1;
  const stepFailures = (get().clusterStepStartAttempts[containerId] ?? 0) + 1;
  set((s) => ({
    clusterStepStartAttempts: { ...s.clusterStepStartAttempts, [containerId]: stepFailures },
  }));

  if (producedWork({ get, childId }) || !isTransientStartFailure({ error })) {
    await failChildStart({ set, get, sessionId, childId, reason: `${message}.` });
    return;
  }
  if (failures >= MAX_START_ATTEMPTS || stepFailures >= MAX_STEP_START_ATTEMPTS) {
    await failChildStart({
      set,
      get,
      sessionId,
      childId,
      reason: `${message}. it failed to start ${failures} ${failures === 1 ? 'time' : 'times'}.`,
    });
    return;
  }

  const delayMs = START_BACKOFF_MS[failures - 1] ?? START_BACKOFF_MS[START_BACKOFF_MS.length - 1]!;
  setTimeout(() => {
    const phaseRuns = get().sessionPhaseRuns[sessionId] ?? [];
    const child = phaseRuns.find((r) => r.id === childId);
    if (child === undefined) {
      return;
    }
    if (isAgentStatusSettled({ status: child.status })) {
      return;
    }
    const session = sessionById(get().sessions, sessionId);
    if (session === undefined) {
      return;
    }
    const workflowRunId =
      child.workflowRunId ?? phaseRuns.find((r) => r.id === containerId)?.workflowRunId;
    const run = session.workflowRuns.find((r) => r.id === workflowRunId);
    if (run?.discardedAt != null) {
      return;
    }
    const turn = get().agentTurnState[childId];
    if (turn?.kind === 'running' || turn?.kind === 'starting') {
      return;
    }
    startChild({
      set,
      get,
      sessionId,
      containerId,
      childId,
      content,
      ...(handoff !== undefined && { handoff }),
      attempt: failures + 1,
    });
  }, delayMs);
};

export const startChild = ({
  set,
  get,
  sessionId,
  containerId,
  childId,
  content,
  handoff,
  attempt = get().clusterStartAttempts[childId] ?? 1,
}: StartChildParams): void => {
  set((s) => ({
    agentTurnState: {
      ...s.agentTurnState,
      [childId]: { kind: 'idle' as const, lastActivityAt: isoNow() },
    },
    clusterStartAttempts: { ...s.clusterStartAttempts, [childId]: attempt },
  }));
  void get()
    .sendTurn({
      sessionId,
      agentId: childId,
      content,
      origin: 'workflow',
      ...(handoff !== undefined && { handoff }),
    })
    .then(() => clusterLaunching.release({ childId }))
    .catch((error: unknown) => {
      void handleChildStartFailure({
        set,
        get,
        sessionId,
        containerId,
        childId,
        content,
        ...(handoff !== undefined && { handoff }),
        error,
      });
    });
};
