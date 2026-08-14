import { turnReducer, type ClaudeFlagSet } from '@goodboy/core';
import { insertMessage, updateSessionState } from '@goodboy/db';
import { formatError, formatUsd } from '@goodboy/ui';
import type {
  AgentId,
  IsoDateTime,
  Message,
  MessageId,
  ProviderId,
  ProviderRunId,
  Session,
  SessionId,
  Step,
  TurnState,
  Workflow,
  WorkflowRunId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { AGENT_FEATURES } from '../../../shared/lib/features';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { degradedNotifiedAgents } from '../../../shared/utils/degradedNotifiedAgents';
import { createTranscriptOwnedTurnError } from '../../../features/chat/turn-errors';
import { runParallelBranch, type ParallelBranchEffects } from '../../parallel-turn';
import { applySessionUpdate } from '../../session-mutators';
import { flushTurnEvents } from '../transcripts/buffer';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { resolveErrorTurnMessage } from './resolveErrorTurnMessage';
import {
  beginTurnFileVersionCapture,
  finalizeTurnFileVersionCapture,
} from '../file-versions/captureTurnFileVersions';
import type { GetFn, SetFn } from './types';

type Params = {
  session: Session;
  sessionId: SessionId;
  activeAgentId: AgentId;
  provider: ProviderId;
  model: string;
  effort: string | undefined;
  cursorMaxMode: boolean | undefined;
  parallelDispatch: {
    template: Workflow;
    currentDef: Step;
    groupDefs: ReadonlyArray<Step>;
  };
  claudeFlags: Partial<ClaudeFlagSet>;
  apiKeyBinding: { apiKeyEnv: string; credentialId: string } | undefined;
  providerBinary: string | undefined;
  workingDir: string;
  userTurnText: string;
  userPromptForPhase: string;
  phasePromptCarryForward: string;
  phaseWorkflowRunId: WorkflowRunId | null;
  now: () => IsoDateTime;
};

export const dispatchParallelTurn = async (
  set: SetFn,
  get: GetFn,
  {
    session,
    sessionId,
    activeAgentId,
    provider,
    model,
    effort,
    cursorMaxMode,
    parallelDispatch,
    claudeFlags,
    apiKeyBinding,
    providerBinary,
    workingDir,
    userTurnText,
    userPromptForPhase,
    phasePromptCarryForward,
    phaseWorkflowRunId,
    now,
  }: Params,
): Promise<void> => {
  const groupSessionRunId = crypto.randomUUID() as ProviderRunId;
  const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
  if (!workspace) {
    get().appendTurnEvent(activeAgentId, sessionId, {
      kind: 'error',
      runId: crypto.randomUUID() as ProviderRunId,
      message: `workspace not found: ${session.workspaceId}`,
      at: now(),
    });
    return;
  }

  const N = Math.min(parallelDispatch.groupDefs.length, AGENT_FEATURES.maxParallelism);

  const sessBudget = get().sessionBudgets[sessionId];
  if (sessBudget) {
    const tele = get().sessionTelemetry[sessionId] ?? [];
    const lastTurnCost = tele.length > 0 ? (tele[tele.length - 1]?.estimatedCostUsd ?? 0) : 0;
    const projected = lastTurnCost * N;
    const sessSpent = (get().sessionSummary?.estimatedCostUsd ?? 0) + projected;
    if (lastTurnCost > 0 && sessSpent > sessBudget.softCapUsd) {
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId: crypto.randomUUID() as ProviderRunId,
        message: `parallel turn aborted: projected spend (${formatUsd(sessSpent)}) would exceed session soft cap (${formatUsd(sessBudget.softCapUsd)}).`,
        at: now(),
      });
      return;
    }
  }
  const isSessionDirScope = isBranchlessSession({
    workspaceKind: workspace.kind,
    branch: get().sessionBranches[sessionId],
  });
  const notifySnapshotFailure = async ({
    stage,
    message,
  }: {
    stage: 'begin' | 'finalize' | 'persist';
    message: string;
  }) => {
    await get().emitNotification(
      'error',
      'warning',
      'Could not capture a recoverable file version for this turn',
      `stage: ${stage}. details: ${message}`,
      { sessionId, workspaceId: session.workspaceId },
    );
  };
  const turnFileVersionCapture = isSessionDirScope
    ? await beginTurnFileVersionCapture({
        sessionId,
        sessionDir: workingDir,
        runId: groupSessionRunId,
        onFailure: notifySnapshotFailure,
      })
    : null;

  const userMessage: Message = {
    id: crypto.randomUUID() as MessageId,
    sessionId,
    agentId: activeAgentId,
    role: 'user',
    content: userTurnText,
    createdAt: now(),
  };
  await insertMessage(tauriDatabase, userMessage);

  get().appendTurnEvent(activeAgentId, sessionId, {
    kind: 'user_text',
    runId: groupSessionRunId,
    text: userTurnText,
    provider,
    model,
    at: userMessage.createdAt,
  });
  let nextStateP: TurnState = session.state;
  if (nextStateP.kind === 'draft') {
    nextStateP = turnReducer(nextStateP, { kind: 'start', at: now() });
  }
  if (nextStateP.kind === 'error') {
    nextStateP = turnReducer(nextStateP, { kind: 'retry', at: now() });
  }
  nextStateP = turnReducer(nextStateP, {
    kind: 'send',
    runId: groupSessionRunId,
    at: now(),
  });
  await updateSessionState(tauriDatabase, sessionId, nextStateP, now());
  applySessionUpdate(set, sessionId, nextStateP, activeAgentId);

  const effects: ParallelBranchEffects = {
    appendTurnEvent: (agentId, sid, ev) => get().appendTurnEvent(agentId, sid, ev),
    refreshPhaseRuns: async (sid) => {
      const runs = await invokeAgentList(sid);
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sid]: runs },
      }));
    },
    setMergeConflicts: (sid, conflicts) => get().setSessionMergeConflicts(sid, conflicts),
    notifyDegradedStepSummary: ({ agentId, sessionId: sid, agentName }) => {
      if (degradedNotifiedAgents.has(agentId)) {
        return;
      }
      degradedNotifiedAgents.add(agentId);
      void get().emitNotification(
        'summarizer-degraded',
        'warning',
        `step summary degraded: ${agentName}`,
        'parallel branch output is not summarized, showing raw output instead.',
        { sessionId: sid, action: { kind: 'retry-step-summary', sessionId: sid, agentId } },
      );
    },
  };

  try {
    const result = await runParallelBranch(
      {
        session,
        ...(phaseWorkflowRunId != null && { workflowRunId: phaseWorkflowRunId }),
        orchestratingAgentId: activeAgentId,
        workspace,
        currentDef: parallelDispatch.currentDef,
        groupDefs: parallelDispatch.groupDefs,
        workingDir,
        resolvedPromptBase: userPromptForPhase,
        carryForwardContext: phasePromptCarryForward,
        mergeStrategy: 'last_write_wins',
        maxParallelism: AGENT_FEATURES.maxParallelism,
      },
      {
        now,
        provider,
        providerBinary,
        model,
        ...(effort !== undefined && { effort }),
        ...(cursorMaxMode === true && { cursorMaxMode: true }),
        authIdentity: get().authResults?.[provider]?.identity ?? null,
        ...(claudeFlags.permissionMode !== undefined && {
          permissionMode: claudeFlags.permissionMode,
        }),
        ...(claudeFlags.allowedTools !== undefined && {
          allowedTools: claudeFlags.allowedTools,
        }),
        ...(claudeFlags.disallowedTools !== undefined && {
          disallowedTools: claudeFlags.disallowedTools,
        }),
        ...(apiKeyBinding ?? {}),
        effects,
      },
    );

    if (result.allFailed) {
      const errorState: TurnState = {
        kind: 'error',
        message: 'all parallel runs failed',
        failedAt: now(),
      };
      await updateSessionState(tauriDatabase, sessionId, errorState, now());
      applySessionUpdate(set, sessionId, errorState, activeAgentId);
    } else {
      const current = get().sessions.find((s) => s.id === sessionId)?.state ?? nextStateP;
      const doneState: TurnState =
        current.kind === 'running'
          ? turnReducer(current, {
              kind: 'receive_event',
              event: { kind: 'done', runId: result.runIds[0]!, at: now() },
            })
          : { kind: 'idle', lastActivityAt: now() };
      await updateSessionState(tauriDatabase, sessionId, doneState, now());
      applySessionUpdate(set, sessionId, doneState, activeAgentId);
    }
  } catch (err) {
    const rawMessage = formatError(err);
    const message = resolveErrorTurnMessage({
      message: rawMessage,
      providerId: provider,
      identity: get().authResults?.[provider]?.identity ?? null,
    });
    get().appendTurnEvent(activeAgentId, sessionId, {
      kind: 'error',
      runId: groupSessionRunId,
      message,
      retryable: true,
      at: now(),
    });
    const errorState: TurnState = {
      kind: 'error',
      message: rawMessage,
      failedAt: now(),
    };
    await updateSessionState(tauriDatabase, sessionId, errorState, now());
    applySessionUpdate(set, sessionId, errorState, activeAgentId);
    throw createTranscriptOwnedTurnError({ message: rawMessage, cause: err });
  } finally {
    flushTurnEvents();
    if (turnFileVersionCapture != null) {
      await finalizeTurnFileVersionCapture({
        sessionId,
        sessionDir: workingDir,
        runId: groupSessionRunId,
        manifest: turnFileVersionCapture.manifest,
        providerRunId: groupSessionRunId,
        onFailure: notifySnapshotFailure,
      });
      if (get().sessionFileVersions[sessionId] !== undefined) {
        await get().loadSessionFileVersions({ sessionId, force: true });
      }
    }
  }
};
