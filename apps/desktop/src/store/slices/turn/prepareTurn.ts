import {
  buildChainCarryForward,
  buildStepPrompt,
  isFallbackStepOutputSummary,
  runsForWorkflowRun,
  type HandoffEarlierStep,
} from '@goodboy/core';
import type { IsoDateTime, ProviderRunId, Step, TurnEvent, WorkflowRunId } from '@goodboy/types';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { scratchDirPrepare, sessionDirExists } from '../../../features/worktree/worktree';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { clearWorkflowTurns } from './workflowTurnBreaker';
import { buildAttachmentPromptBlock } from './turnHelpers';
import { selectActiveMount, selectMountById } from '../project-mounts/selectors';
import { selectAutomaticTurnMount } from '../project-mounts/selectAutomaticTurnMount';
import { rewriterCopyFor } from '../history/rewriterCopyFor';
import { queueTurnInLane } from '../resolve/queueTurnInLane';
import { resolverLaunchCopy } from '../resolve/resolverLaunchCopy';
import { resolveWriteDestination } from '../project-mounts/writeDestination';
import { resolveSkillPrompt } from './resolveSkillPrompt';
import { persistAttachments } from './persistAttachments';
import type { GetFn, SetFn, SendTurnInput, TurnPhaseValue } from './types';
import { sessionById } from '../sessions/sessionIndex';
import { projectById } from '../projects/projectIndex';
import { selectFirstLapProject } from '../bootstrap/firstLap';
import { turnDone, turnReady } from './turnPhase';
import { NOT_BLOCKED } from './notBlocked';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  input: SendTurnInput;
}>;

export const prepareTurn = async ({ set, get, input }: Params) => {
  const {
    sessionId,
    agentId,
    mountId,
    mountTarget,
    resolveCopyPath,
    content,
    attachments,
    origin,
    retry,
  } = input;
  const before = get();
  const session = sessionById(before.sessions, sessionId);
  if (!session) {
    throw new Error(`session not found: ${sessionId}`);
  }
  const operatorAnchor = content.trim();
  if (origin === 'operator' && operatorAnchor.length > 0) {
    set((state) => ({
      sessionLanguageAnchor: {
        ...state.sessionLanguageAnchor,
        [sessionId]: operatorAnchor.slice(0, 280),
      },
    }));
  }
  const workspaceProjects = before.projects.filter(
    (project) => project.workspaceId === session.workspaceId,
  );
  const launchAgentId = agentId ?? before.selectedAgentId[sessionId] ?? null;
  if (
    resolveCopyPath === undefined &&
    launchAgentId !== null &&
    origin !== 'mount-continuation' &&
    (await queueTurnInLane({
      get,
      sessionId,
      agentId: launchAgentId,
      content,
      threadIds: input.resolveThreadIds,
    }))
  ) {
    void get().drainResolveQueue({ sessionId });
    return turnDone({ result: { blockedOverBudget: false, isLaneQueued: true } });
  }
  const launchCopy =
    resolveCopyPath !== undefined || launchAgentId === null || origin === 'mount-continuation'
      ? null
      : await resolverLaunchCopy({ get, sessionId, agentId: launchAgentId });
  const aimedMountId = mountTarget?.mountId ?? launchCopy?.mountTarget?.mountId ?? mountId;
  const aimedMount =
    aimedMountId === undefined
      ? null
      : selectMountById({ state: before, sessionId, mountId: aimedMountId });
  if (aimedMountId !== undefined && aimedMount === null) {
    throw new Error('The branch mount this turn was aimed at is no longer in the session.');
  }
  const isFrozenTargetHeld =
    mountTarget === undefined ||
    (aimedMount !== null &&
      aimedMount.worktreePath === mountTarget.worktreePath &&
      aimedMount.revision === mountTarget.mountRevision);
  if (!isFrozenTargetHeld) {
    throw new Error('the branch mount this turn was queued on changed before it could start');
  }
  const rewriterAgentId = agentId ?? before.selectedAgentId[sessionId] ?? null;
  const rewriterCopy =
    rewriterAgentId === null
      ? null
      : rewriterCopyFor({ state: before, sessionId, agentId: rewriterAgentId });
  const selectedMount =
    rewriterCopy !== null ? null : (aimedMount ?? selectActiveMount({ state: before, sessionId }));
  const activeMount =
    rewriterCopy !== null
      ? undefined
      : (selectedMount ?? selectAutomaticTurnMount({ state: before, sessionId }) ?? undefined);
  const turnTarget =
    activeMount === undefined
      ? null
      : {
          mountId: activeMount.mountId,
          mountRevision: activeMount.revision,
          worktreePath: activeMount.worktreePath,
        };
  const turnMountId = turnTarget?.mountId ?? null;
  const turnMountRevision = turnTarget?.mountRevision ?? null;
  const copyPath = rewriterCopy === null ? (resolveCopyPath ?? launchCopy?.copyPath ?? null) : null;
  const firstLapProject =
    rewriterCopy === null && copyPath === null && activeMount === undefined
      ? selectFirstLapProject({ state: before, sessionId })
      : null;
  const workingDir =
    rewriterCopy !== null
      ? rewriterCopy.copyPath
      : copyPath !== null
        ? copyPath
        : activeMount !== undefined
          ? activeMount.worktreePath
          : firstLapProject !== null
            ? firstLapProject.rootPath
            : await scratchDirPrepare({ sessionId });
  const isPlainSessionDir =
    activeMount !== undefined && isBranchlessSession({ branch: activeMount.branch });
  if (isPlainSessionDir) {
    const exists = await sessionDirExists({ path: workingDir });
    if (exists === false) {
      throw new Error(
        'Session directory not found. It may have been moved outside the workspace folder.',
      );
    }
  }

  const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

  const activeAgentId = agentId ?? before.selectedAgentId[sessionId] ?? null;
  if (!activeAgentId) {
    throw new Error('no agent selected. spawn one before sending a turn');
  }
  if (origin === 'operator') {
    clearWorkflowTurns({ agentId: activeAgentId });
  }
  const activeAgent = (before.sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.id === activeAgentId,
  );
  if (activeAgent?.doneAt != null) {
    await get().clearAgentDone(sessionId, activeAgentId);
  }

  const turnDestinationProjectName =
    activeMount !== undefined
      ? (projectById(before.projects, activeMount.projectId)?.name ?? null)
      : null;
  set((state) => ({
    agentTurnDestination: {
      ...state.agentTurnDestination,
      [activeAgentId]: resolveWriteDestination({
        mount: activeMount ?? null,
        projectName: turnDestinationProjectName,
        scratchPath: activeMount === undefined && firstLapProject === null ? workingDir : null,
        root:
          firstLapProject === null
            ? null
            : {
                projectId: firstLapProject.id,
                projectName: firstLapProject.name,
                path: firstLapProject.rootPath,
                branch: 'main',
              },
      }),
    },
  }));

  const userTurnText = content;

  const slashResult = await resolveSkillPrompt(get, {
    before,
    session,
    sessionId,
    activeAgentId,
    workingDir,
    content,
    now,
  });
  if (!slashResult.ok) {
    return turnDone({ result: NOT_BLOCKED });
  }
  let resolvedPrompt = slashResult.resolvedPrompt;

  const attachmentInputs = attachments ?? [];
  const alreadyPersistedRefs = retry?.attachmentRefs ?? [];
  const attachmentResult =
    retry != null
      ? {
          ok: true as const,
          attachmentRefs: alreadyPersistedRefs,
          resolvedPrompt:
            alreadyPersistedRefs.length > 0
              ? `${resolvedPrompt}\n\n${buildAttachmentPromptBlock(alreadyPersistedRefs)}`
              : resolvedPrompt,
        }
      : await persistAttachments(get, {
          attachmentInputs,
          workingDir,
          ...(firstLapProject !== null &&
            attachmentInputs.length > 0 && {
              attachmentDir: await scratchDirPrepare({ sessionId }),
            }),
          activeAgentId,
          sessionId,
          resolvedPrompt,
          now,
        });
  if (!attachmentResult.ok) {
    return turnDone({ result: NOT_BLOCKED });
  }
  const attachmentRefs = attachmentResult.attachmentRefs;
  resolvedPrompt = attachmentResult.resolvedPrompt;

  let phaseDefinition: Step | null = null;
  let phaseWorkflowRunId: WorkflowRunId | null = null;
  let phasePromptCarryForward = '';
  let phaseTransitionEvent: Extract<TurnEvent, { kind: 'step_transition' }> | null = null;
  let handoffEarlierSteps: ReadonlyArray<HandoffEarlierStep> = [];
  if (session.workflowRuns.length > 0) {
    const freshRuns = await invokeAgentList(sessionId);
    set((state) => ({
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: freshRuns },
    }));
    const initialRuns = before.sessionPhaseRuns[sessionId] ?? [];
    const activeAgentRow =
      freshRuns.find((r) => r.id === activeAgentId) ??
      initialRuns.find((r) => r.id === activeAgentId) ??
      null;
    const activeRun = activeAgentRow?.workflowRunId
      ? session.workflowRuns.find((r) => r.id === activeAgentRow.workflowRunId)
      : undefined;
    const templates = get().phaseTemplates[session.workspaceId] ?? [];
    const template = activeRun
      ? (templates.find((t) => t.id === activeRun.workflowId) ?? null)
      : null;
    const runAgents = activeRun ? runsForWorkflowRun(freshRuns, activeRun.id) : freshRuns;
    if (template) {
      const nextDef = template.steps.find((s) => s.id === activeAgentRow!.stepId) ?? null;
      if (nextDef) {
        const sortedDefs = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
        const predecessorDefinitions = sortedDefs.filter(
          (definition) => definition.ordinal < nextDef.ordinal,
        );
        const completedPredecessors = predecessorDefinitions.flatMap((definition) => {
          const completedAgent = runAgents.find(
            (agent) => agent.stepId === definition.id && agent.status === 'completed',
          );
          return completedAgent == null ? [] : [completedAgent];
        });
        const immediatePredecessor = completedPredecessors.at(-1) ?? null;
        const hasAssistantTurn = (before.transcripts[activeAgentId] ?? []).some(
          (event) => event.kind === 'assistant_text',
        );
        if (immediatePredecessor != null && !hasAssistantTurn) {
          const carryForwardContext = buildChainCarryForward({
            steps: completedPredecessors.map((agent) => ({
              ordinal: agent.ordinal,
              name: agent.name,
              outputSummary: agent.outputSummary,
            })),
          });
          const predecessorSummary = immediatePredecessor.outputSummary ?? '';
          const recordedDegraded = get().stepSummaryDegraded[immediatePredecessor.id];
          const isDegraded =
            recordedDegraded ??
            (predecessorSummary.trim().length === 0 ||
              isFallbackStepOutputSummary({ summary: predecessorSummary }));
          const durationMs =
            immediatePredecessor.startedAt != null && immediatePredecessor.completedAt != null
              ? new Date(immediatePredecessor.completedAt).getTime() -
                new Date(immediatePredecessor.startedAt).getTime()
              : null;
          phasePromptCarryForward = carryForwardContext;
          handoffEarlierSteps = completedPredecessors.map((agent) => ({
            agentId: agent.id,
            ordinal: agent.ordinal,
            name: agent.name,
            summary: agent.outputSummary ?? null,
          }));
          phaseTransitionEvent = {
            kind: 'step_transition',
            runId: 'pending' as ProviderRunId,
            fromStep: {
              ordinal: immediatePredecessor.ordinal,
              name: immediatePredecessor.name,
            },
            toStep: { ordinal: nextDef.ordinal, name: nextDef.name },
            carryForwardContext,
            sessionId,
            fromAgentId: immediatePredecessor.id,
            ...(isDegraded && { degraded: true }),
            ...(durationMs != null && { durationMs }),
            at: now(),
          };
        }
        phaseDefinition = nextDef;
        phaseWorkflowRunId = activeRun?.id ?? null;

        const prefix = nextDef.promptPrefix.trim();
        const hasPrefixAlready = prefix.length > 0 && resolvedPrompt.includes(prefix);
        resolvedPrompt = buildStepPrompt({
          definition: hasPrefixAlready ? { ...nextDef, promptPrefix: '' } : nextDef,
          carryForwardContext: phasePromptCarryForward,
          userMessage: resolvedPrompt,
        });
      }
    }
  }
  return turnReady({
    value: {
      session,
      workspaceProjects,
      rewriterCopy,
      activeMount,
      turnTarget,
      turnMountId,
      turnMountRevision,
      copyPath,
      firstLapProject,
      workingDir,
      now,
      activeAgentId,
      activeAgent,
      userTurnText,
      resolvedPrompt,
      attachmentRefs,
      phaseDefinition,
      phaseWorkflowRunId,
      phaseTransitionEvent,
      handoffEarlierSteps,
    },
  });
};

export type PreparedTurn = TurnPhaseValue<typeof prepareTurn>;
