import { renderHandoff } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { AgentTurnSpan } from '@goodboy/types';
import {
  AGENT_KIND_DEFAULTS,
  KIND_TO_ROLE,
  kindWritesFiles,
} from '../../../features/session/agent-kind';
import { isQueryBridgeServing } from '../../../features/integrations/queryBridge';
import { buildIntegrationsGuard } from './integrationsGuard';
import { buildProfileGuard } from './profileGuard';
import { isQuestionDelegate } from '../../../features/context/questionDelegate';
import { buildScopeGuard } from '../project-mounts/scopeGuard';
import { buildSessionLanguageGuard, resolveSessionLanguageGoal } from './sessionLanguage';
import { beginTurnFileVersionCapture } from '../file-versions/captureTurnFileVersions';
import { applyHeuristicTitle } from './applyHeuristicTitle';
import { fanOutChildKind } from '../agents/fanOutChildKind';
import { resolveCandidateMode } from '../resolve/resolveCandidateMode';
import { resumableResolveThreadIds } from '../resolve/resumableResolveThreadIds';
import { selectWritableMounts } from '../project-mounts/selectors';
import { rewriterWritableRoots } from '../history/rewriterWritableRoots';
import {
  buildTurnWritableRoots,
  isTurnWritableMount,
  repoRootsForTurn,
  resolveGitCommonDirs,
} from './turnWritableRoots';
import { createResolveCandidateWriter } from './createResolveCandidateWriter';
import { collectTouchedMounts } from './collectTouchedMounts';
import { composeAgentHandoff } from './composeAgentHandoff';
import { snapshotMountChanges } from './snapshotMountChanges';
import type { GetFn, SetFn, TurnLease, TurnProgress, WithInput } from './types';
import { projectById } from '../projects/projectIndex';
import type { PreparedTurn } from './prepareTurn';
import type { RoutedTurn } from './routeTurn';
import type { LeasedTurn } from './leaseTurnWriter';
import type { StartedTurn } from './startTurnRun';
import type { BuiltPrompt } from './buildTurnPrompt';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  lease: TurnLease;
  ctx: WithInput & PreparedTurn & RoutedTurn & LeasedTurn & StartedTurn & BuiltPrompt;
}>;

export const buildTurnSpawn = async ({ set, get, lease, ctx }: Params) => {
  let resolvedPrompt = ctx.resolvedPrompt;
  const { sessionId, content, origin, handoff } = ctx.input;
  const {
    session,
    workspaceProjects,
    rewriterCopy,
    activeMount,
    turnTarget,
    turnMountId,
    copyPath,
    firstLapProject,
    workingDir,
    now,
    activeAgentId,
    activeAgent,
    userTurnText,
    attachmentRefs,
    phaseDefinition,
    phaseWorkflowRunId,
    handoffEarlierSteps,
    provider,
    model,
    rawEffort,
    effortFlag,
    isCopyTurn,
    runId,
    isFirstTurn,
    isHandoffTurn,
    agentRowEarly,
    earlyAgentKind,
    childRoutingBlock,
    clusterBoundary,
    goalAttachments,
    verbosityHint,
    handoffBodyLayers,
  } = ctx;
  const resolveAttemptId =
    earlyAgentKind === 'resolver' && agentRowEarly !== null
      ? await get().recordResolveAttempt({
          sessionId,
          agent: agentRowEarly,
          provider,
          model,
          effort: rawEffort,
          instructions: resolvedPrompt,
          phase: 'running',
          mountTarget: turnTarget,
          threadIds: resumableResolveThreadIds({
            rows: get().sessionResolveThreads[sessionId] ?? [],
            agent: agentRowEarly,
          }),
          candidateMode: isCopyTurn
            ? 'propose'
            : resolveCandidateMode({
                agents: get().sessionPhaseRuns[sessionId] ?? [],
                resolverId: activeAgentId,
                isOperatorTurn: origin === 'operator',
              }),
        })
      : undefined;
  lease.attemptId = resolveAttemptId;
  const progress: TurnProgress = {
    assistantText: '',
    providerThreadId: activeAgent?.providerSessionId ?? null,
    receivedProviderError: false,
    receivedStreamError: false,
    lastError: null,
    turnWasCancelled: false,
    shouldAutoAdvanceWorkflow: false,
    filesTouchedThisTurn: new Set<string>(),
    editedPathsThisTurn: new Set<string>(),
  };
  const resolveCandidateWriter = createResolveCandidateWriter({
    persist: async () => {
      if (resolveAttemptId === undefined || agentRowEarly === null) {
        return;
      }
      await get().persistResolveTurn({
        sessionId,
        agent: agentRowEarly,
        assistantText: progress.assistantText,
        isCandidate: true,
        attemptId: resolveAttemptId,
      });
    },
  });
  const resumeSessionId =
    origin !== 'mount-continuation' && agentRowEarly?.providerSessionProviderId === provider
      ? agentRowEarly.providerSessionId
      : undefined;

  const kindSystemPrompt = AGENT_KIND_DEFAULTS[earlyAgentKind].systemPrompt;

  const scopeMounts =
    rewriterCopy !== null || copyPath !== null
      ? []
      : selectWritableMounts({ state: get(), sessionId });
  const activeProject =
    activeMount !== undefined ? projectById(get().projects, activeMount.projectId) : undefined;
  const isSessionDirScope = activeProject?.kind === 'folder';
  const notifySnapshotFailure = async ({
    stage,
    message,
  }: {
    stage: 'begin' | 'finalize' | 'persist';
    message: string;
  }) => {
    await get().emitNotification({
      kind: 'error',
      severity: 'warning',
      title: "Couldn't capture a recoverable file version for this turn",
      body: `stage: ${stage}. details: ${message}`,
      sessionId,
      workspaceId: session.workspaceId,
    });
  };
  const turnFileVersionCapture = isSessionDirScope
    ? await beginTurnFileVersionCapture({
        sessionId,
        sessionDir: workingDir,
        runId,
        onFailure: notifySnapshotFailure,
      })
    : null;
  const isBridgeServing = await isQueryBridgeServing();
  const scopeGuard = buildScopeGuard({
    workingDir,
    projects: workspaceProjects,
    mounts: scopeMounts,
    activeMountId: turnMountId,
    isBridgeServing,
    isSessionDirScope,
    firstLapProject,
    canWrite: kindWritesFiles({ kind: earlyAgentKind }),
  });
  const anchorText = get().sessionLanguageAnchor[sessionId] ?? '';
  const languageGuard = buildSessionLanguageGuard({
    anchor:
      anchorText.length > 0
        ? { source: 'message', text: anchorText }
        : {
            source: 'goal',
            text: resolveSessionLanguageGoal({
              session,
              workflows: get().phaseTemplates[session.workspaceId] ?? [],
              ...(agentRowEarly?.workflowRunId != null && {
                workflowRunId: agentRowEarly.workflowRunId,
              }),
            }),
          },
  });
  const githubMode = get().githubStatus?.mode;
  const isGithubConnected = githubMode === 'pat' || githubMode === 'gh-cli';
  const integrationsGuard = buildIntegrationsGuard({
    providers: [
      ...(get().workspaceIntegrations[session.workspaceId] ?? []).map(
        (integration) => integration.provider,
      ),
      ...(isGithubConnected ? (['github'] as const) : []),
    ],
    isBridgeServing,
  });
  const profileGuard = buildProfileGuard({
    profile: get().workspaces.find((candidate) => candidate.id === session.workspaceId)?.profile,
    audience:
      agentRowEarly !== null && isQuestionDelegate({ agent: agentRowEarly })
        ? 'questionDelegate'
        : (phaseDefinition?.role ?? KIND_TO_ROLE[earlyAgentKind]),
  });
  const guards = [scopeGuard, languageGuard, integrationsGuard, profileGuard]
    .filter((block) => block.length > 0)
    .join('\n\n');
  const renderedHandoff = renderHandoff({
    ...handoffBodyLayers,
    provider,
    guards,
    roleInstructions: kindSystemPrompt ?? '',
  });
  const fullSystemPrompt = renderedHandoff.system;
  const gitDirs = await resolveGitCommonDirs({
    repoRoots: repoRootsForTurn({ mounts: scopeMounts }),
  });
  const isolatedCopyPath = rewriterCopy?.copyPath ?? copyPath;
  const writableRoots =
    isolatedCopyPath !== null
      ? await rewriterWritableRoots({ copyPath: isolatedCopyPath })
      : buildTurnWritableRoots({
          mounts: scopeMounts,
          workingDir,
          gitDirs,
        });

  resolvedPrompt = renderedHandoff.message;

  if (isHandoffTurn) {
    try {
      await get().recordAgentHandoff({
        handoff: composeAgentHandoff({
          get,
          session,
          sessionId,
          agentId: activeAgentId,
          agentKind: earlyAgentKind,
          draft: handoff,
          content: userTurnText,
          step: phaseDefinition,
          workflowRunId: phaseWorkflowRunId ?? agentRowEarly?.workflowRunId ?? null,
          earlierSteps: handoffEarlierSteps,
          attachments: attachmentRefs,
          goalAttachments,
          mounts: scopeMounts,
          rules: {
            scope: scopeGuard,
            language: languageGuard,
            integrations: integrationsGuard,
            replies: verbosityHint,
            routing: childRoutingBlock,
            cluster: clusterBoundary === null ? '' : clusterBoundary.block,
          },
          profile: profileGuard,
          roleInstructions: kindSystemPrompt ?? '',
          rendered: renderedHandoff,
          provider,
          createdAt: now(),
        }),
      });
    } catch (error) {
      console.warn(`[handoff] ${activeAgentId}: ${formatError(error)}`);
    }
  }

  const isChildOfFanOut =
    agentRowEarly !== null &&
    fanOutChildKind({
      agent: agentRowEarly,
      runs: get().sessionPhaseRuns[sessionId] ?? [],
      agentKindOverride: get().agentKindOverride,
    }) !== null;
  if (isFirstTurn && !isChildOfFanOut) {
    void applyHeuristicTitle({ set, get, sessionId, agentId: activeAgentId, prompt: content });
  }

  const turnSpanBase: Omit<AgentTurnSpan, 'endedAt' | 'endReason' | 'touchedMountIds'> = {
    runId,
    agentId: activeAgentId,
    sessionId,
    workspaceId: session.workspaceId,
    workflowRunId: phaseWorkflowRunId ?? agentRowEarly?.workflowRunId ?? null,
    stepRole: phaseDefinition?.role ?? KIND_TO_ROLE[earlyAgentKind],
    provider,
    model,
    effort: effortFlag ?? null,
    startedAt: now(),
  };
  const turnMounts = scopeMounts.filter(isTurnWritableMount);
  const mountChangesBefore = snapshotMountChanges({
    mounts: turnMounts,
    projects: get().projects,
  });
  const touchedMountsForTurn = () =>
    collectTouchedMounts({
      get,
      sessionId,
      agentId: activeAgentId,
      mounts: turnMounts,
      workingDir,
      editedPaths: Array.from(progress.editedPathsThisTurn),
      before: mountChangesBefore,
      startedAt: turnSpanBase.startedAt,
    });
  return {
    resolveAttemptId,
    progress,
    resolveCandidateWriter,
    resumeSessionId,
    isSessionDirScope,
    notifySnapshotFailure,
    turnFileVersionCapture,
    fullSystemPrompt,
    writableRoots,
    isolatedCopyPath,
    turnSpanBase,
    touchedMountsForTurn,
    resolvedPrompt,
  };
};

export type BuiltSpawn = Awaited<ReturnType<typeof buildTurnSpawn>>;
