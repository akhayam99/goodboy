import { analyzeFailingChecks } from '../../branch/checks/analyzeFailingChecks';
import { failingChecksOf } from '../../branch/checks/failingChecksOf';
import { NAMES } from '../../../shared/names';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, Session, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, agentPlace, sessionPlace } from '../../../store';
import { branchPlace } from '../../../store/slices/navigation/place';
import { isMountCompleted } from '../../../store/slices/project-mounts/mountRowModel';
import { startRebaseTarget } from '../startRebaseTarget';
import { REBASE_ALL_MIN_BRANCHES } from '../../history/behindBranchesOf';
import { distanceBehind } from '../../../shared/lib/gitStatus';
import { usePlanRunToast } from '../../plans/usePlanRun';
import type { AgentKind, AgentKindRouting } from '../../session/agent-kind';
import { showsRunsOn } from '../../session/showsRunsOn';
import { REBASE_FAILURE_TITLE, useRebaseBranch } from '../../session/hooks/useRebaseBranch';
import { useWorktreeStatuses } from '../../session/hooks/useWorktreeStatuses';
import { useAdvanceWorkflowAgent } from '../../workflows/useAdvanceWorkflowAgent';
import { REVIEW_LAUNCH_LABEL } from '../../resolve/reviewLaunchCopy';
import { prLifecycleFailureTitle } from '../../review/prLifecycle';
import { requestReview } from '../../review/reviewRequest';
import { useFixableThreadIds } from '../../resolve/useFixableThreadIds';
import { useMountProposalActions } from '../useMountProposalActions';
import { useOpenAgentQuestion } from '../../context/hooks/useOpenAgentQuestion';
import type { RebaseSuggestionTarget, SessionSuggestion } from '../types';
import { projectById } from '../../../store/slices/projects/projectIndex';

const openProviderSignIn = ({ providerId }: { readonly providerId: string }) =>
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', {
      detail: { scope: 'providers', provider: providerId, action: 'login' },
    }),
  );

type Params = {
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
  readonly onSelectQuestions: () => void;
};

type SuggestionAction = {
  readonly label: string;
  readonly shortLabel?: string;
  readonly agentKind?: AgentKind;
  readonly isDisabled: boolean;
  readonly isBusy?: boolean;
  readonly failureTitle: string;
  readonly run: () => Promise<void>;
  readonly requiresConfirm?: boolean;
  readonly runsOn?: SuggestionRunsOn;
  readonly shouldOpenPicker?: boolean;
};

type SuggestionRunsOn = {
  readonly kind: AgentKind;
  readonly runWith: (routing: AgentKindRouting) => Promise<void>;
};

export type SuggestionActions = {
  readonly primary: SuggestionAction | null;
  readonly onDismiss: (() => Promise<void>) | null;
};

export type SuggestionActionResolver = (params: {
  readonly suggestion: SessionSuggestion;
}) => SuggestionActions;

const NO_ACTIONS: SuggestionActions = { primary: null, onDismiss: null };

type AnalyzeParams = {
  readonly routing?: AgentKindRouting;
};

type StartRebaseParams = {
  readonly target: RebaseSuggestionTarget;
};

export const useSuggestionActions = ({
  session,
  agents,
  onSelectQuestions,
}: Params): SuggestionActionResolver => {
  const sessionId = session.id;
  const openAgentQuestion = useOpenAgentQuestion({ sessionId });
  const mounts = useAppStore(
    (state) =>
      state.sessionProjectMounts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionProjectMount>),
  );
  const projects = useAppStore((state) => state.projects);
  const completedMountIds = useAppStore(
    useShallow((state) =>
      mounts.flatMap((mount) =>
        isMountCompleted({ state, mountId: mount.mountId }) ? [mount.mountId] : [],
      ),
    ),
  );
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const resumeStoppedAgents = useAppStore((state) => state.resumeStoppedAgents);
  const navigate = useAppStore((state) => state.navigate);
  const advanceAgent = useAdvanceWorkflowAgent({ sessionId });
  const proposalActions = useMountProposalActions({ sessionId });
  const runPlan = useAppStore((state) => state.runPlan);
  const pushSessionBranch = useAppStore((state) => state.pushSessionBranch);
  const openRewriteHistory = useAppStore((state) => state.openRewriteHistory);
  const markPrReady = useAppStore((state) => state.markPrReady);
  const mergePr = useAppStore((state) => state.mergePr);
  const resolveMountCleanup = useAppStore((state) => state.resolveMountCleanup);
  const attachWorkflowToSession = useAppStore((state) => state.attachWorkflowToSession);
  const announcePlanRun = usePlanRunToast();

  const rebaseMounts = useMemo(
    () => mounts.filter((mount) => !completedMountIds.includes(mount.mountId)),
    [completedMountIds, mounts],
  );

  const targets = useMemo(
    () =>
      rebaseMounts.map((mount) => ({
        worktreePath: mount.worktreePath,
        baseBranch: projectById(projects, mount.projectId)?.baseBranch ?? undefined,
      })),
    [projects, rebaseMounts],
  );
  const statuses = useWorktreeStatuses({ targets });
  const behind = useMemo(() => {
    for (const mount of rebaseMounts) {
      const status = statuses.get(mount.worktreePath) ?? null;
      const distance = status == null ? null : distanceBehind({ distance: status.mainDistance });
      if (distance != null && distance > 0) {
        return { status, mountId: mount.mountId };
      }
    }
    return null;
  }, [rebaseMounts, statuses]);
  const rebase = useRebaseBranch({
    sessionId,
    mountId: behind?.mountId ?? null,
    status: behind?.status ?? null,
  });

  const isRebaseAllRunning = useAppStore(
    (state) => state.rebaseAllRuns[sessionId]?.phase === 'running',
  );

  const threadIds = useFixableThreadIds({ sessionId });

  const openFixPanel = async (): Promise<void> => {
    if (threadIds.length === 0) {
      return;
    }
    requestReview({
      getState: useAppStore.getState,
      sessionId,
      request: { kind: 'fix', threadIds },
    });
  };

  const startRebase = async ({ target }: StartRebaseParams): Promise<void> => {
    startRebaseTarget({ openRewriteHistory, sessionId, target });
  };

  const startWorkflowStep = ({
    suggestion,
  }: {
    readonly suggestion: Extract<SessionSuggestion, { readonly kind: 'workflow-next-step' }>;
  }): Promise<void> => {
    const next =
      agents.find(
        (agent) =>
          agent.workflowRunId === suggestion.payload.runId &&
          agent.stepId === suggestion.payload.stepId &&
          agent.status === 'pending',
      ) ?? null;
    return advanceAgent({ agent: next });
  };

  const proposalTarget = ({
    suggestion,
  }: {
    readonly suggestion: Extract<SessionSuggestion, { readonly kind: 'mount-project' }>;
  }) => ({
    projectId: suggestion.payload.projectId,
    projectName: suggestion.payload.projectName,
    reason: suggestion.payload.reason,
  });

  return ({ suggestion }) => {
    if (suggestion.kind === 'workflow-next-step') {
      return {
        primary: {
          label: 'Continue',
          isDisabled: false,
          failureTitle: "The next step didn't start",
          run: () => startWorkflowStep({ suggestion }),
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'resolve-threads') {
      return {
        primary: {
          label: REVIEW_LAUNCH_LABEL.fix,
          isDisabled: false,
          failureTitle: "The fix panel didn't open",
          run: openFixPanel,
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'rebase-project') {
      const firstTarget = suggestion.payload.targets[0] ?? null;
      if (suggestion.payload.targets.length >= REBASE_ALL_MIN_BRANCHES) {
        return {
          primary: {
            label: isRebaseAllRunning ? 'Rebasing' : 'Choose branches to rebase',
            shortLabel: isRebaseAllRunning ? 'Rebasing' : 'Rebase',
            isDisabled: isRebaseAllRunning,
            isBusy: isRebaseAllRunning,
            failureTitle: REBASE_FAILURE_TITLE,
            shouldOpenPicker: true,
            run: async () => undefined,
          },
          onDismiss: null,
        };
      }
      return {
        primary: {
          label: rebase.isRunning ? 'Rebasing' : 'Open rebase',
          shortLabel: rebase.isRunning ? 'Rebasing' : 'Rebase',
          isDisabled: firstTarget == null || rebase.isRunning,
          isBusy: rebase.isRunning,
          failureTitle: REBASE_FAILURE_TITLE,
          run: async () => {
            if (firstTarget == null) {
              return;
            }
            await startRebase({ target: firstTarget });
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'plan-ready') {
      return {
        primary: {
          label: 'Start implementer',
          shortLabel: 'Start',
          agentKind: 'implementer',
          isDisabled: false,
          failureTitle: "Couldn't start the implementer",
          run: async () => {
            announcePlanRun({
              result: await runPlan(sessionId, suggestion.payload.planId),
              sessionId,
            });
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'answer-questions') {
      const { count, firstQuestion } = suggestion.payload;
      return {
        primary: {
          label: 'Answer',
          isDisabled: false,
          failureTitle: "Couldn't open the questions",
          run: async () => {
            if (count === 1 && firstQuestion != null) {
              openAgentQuestion({ question: firstQuestion });
              return;
            }
            onSelectQuestions();
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'mount-project') {
      return {
        primary: {
          label: 'Add project',
          shortLabel: 'Add',
          isDisabled: false,
          failureTitle: "Couldn't add the project",
          run: () => proposalActions.mount(proposalTarget({ suggestion })),
        },
        onDismiss: async () => proposalActions.dismiss(proposalTarget({ suggestion })),
      };
    }
    if (suggestion.kind === 'approve-tool') {
      return {
        primary: {
          label: 'Review',
          isDisabled: false,
          failureTitle: "Couldn't open the agent",
          run: async () =>
            navigate({ to: agentPlace({ sessionId, agentId: suggestion.payload.agentId }) }),
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'sign-in') {
      return {
        primary: {
          label: 'Sign in',
          isDisabled: false,
          failureTitle: "Couldn't open the sign-in",
          run: async () => {
            openProviderSignIn({ providerId: suggestion.payload.providerId });
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'resume-agents') {
      return {
        primary: {
          label: suggestion.payload.agentIds.length === 1 ? 'Resume' : 'Resume all',
          shortLabel: 'Resume',
          isDisabled: false,
          failureTitle: "Couldn't resume the stopped agents",
          run: async () => {
            await resumeStoppedAgents({ sessionId });
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'retry-agent') {
      return {
        primary: {
          label: 'Retry',
          agentKind: suggestion.payload.agentKind,
          isDisabled: false,
          failureTitle: "Couldn't retry",
          run: async () => {
            await spawnAgent(sessionId, {
              kindOverride: suggestion.payload.agentKind,
              focus: 'none',
            });
          },
          ...(showsRunsOn({ kind: suggestion.payload.agentKind }) && {
            runsOn: {
              kind: suggestion.payload.agentKind,
              runWith: async (routing: AgentKindRouting) => {
                await spawnAgent(sessionId, {
                  kindOverride: suggestion.payload.agentKind,
                  focus: 'none',
                  ...routing,
                });
              },
            },
          }),
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'check-changes') {
      return {
        primary: {
          label: 'Start reviewer',
          shortLabel: 'Start',
          agentKind: 'reviewer',
          isDisabled: false,
          failureTitle: "Couldn't start the reviewer",
          run: async () => {
            await spawnAgent(sessionId, { kindOverride: 'reviewer', focus: 'none' });
          },
          runsOn: {
            kind: 'reviewer',
            runWith: async (routing) => {
              await spawnAgent(sessionId, { kindOverride: 'reviewer', focus: 'none', ...routing });
            },
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'fix-checks') {
      const readFailing = () =>
        failingChecksOf({
          state: useAppStore.getState(),
          sessionId,
          mountId: suggestion.payload.mountId,
          prNumber: suggestion.payload.prNumber,
        });
      const analyze = async ({ routing }: AnalyzeParams = {}) => {
        const state = useAppStore.getState();
        const github = state.mountGithub[suggestion.payload.mountId];
        if (
          github?.pr?.number === suggestion.payload.prNumber &&
          (github.detail === null || github.detail.prNumber !== suggestion.payload.prNumber)
        ) {
          await state.refreshSessionPrDetail(sessionId, {
            mountId: suggestion.payload.mountId,
            force: true,
          });
        }
        const failing = readFailing();
        if (failing === null) {
          throw new Error('Refresh the failing checks and try Analyze again.');
        }
        await analyzeFailingChecks({
          sessionId,
          mountId: suggestion.payload.mountId,
          pullRequest: failing.pullRequest,
          checks: failing.checks,
          ...(routing !== undefined && { routing }),
        });
      };
      const isAnalyzedBefore = suggestion.payload.progress?.chain === 'fixed-pushed';
      return {
        primary: {
          label: isAnalyzedBefore ? 'Analyze again' : 'Analyze',
          agentKind: 'debugger',
          isDisabled: false,
          failureTitle: "Couldn't start the Debugger",
          run: () => analyze(),
          runsOn: {
            kind: 'debugger',
            runWith: (routing) => analyze({ routing }),
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'push-branch' && suggestion.payload.state === 'diverged') {
      return {
        primary: {
          label: 'Review history',
          shortLabel: 'Review',
          isDisabled: false,
          failureTitle: "Couldn't open the history",
          run: async () => openRewriteHistory(sessionId, suggestion.payload.worktreePath),
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'push-branch') {
      return {
        primary: {
          label: 'Push',
          isDisabled: false,
          failureTitle: "Couldn't push the branch",
          run: async () => {
            const result = await pushSessionBranch({
              sessionId,
              mountId: suggestion.payload.mountId,
            });
            if (!result.ok) {
              throw new Error(result.error);
            }
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'open-pr') {
      const scribe = suggestion.payload.scribe ?? null;
      if (scribe === 'writing' || scribe === 'creating') {
        return NO_ACTIONS;
      }
      const mount = mounts.find((candidate) => candidate.mountId === suggestion.payload.mountId);
      return {
        primary: {
          label: scribe === 'ready' ? 'Review text' : 'Open PR',
          shortLabel: scribe === 'ready' ? 'Review' : 'Open',
          isDisabled: false,
          failureTitle: "Couldn't open the pull request form",
          run: async () => {
            navigate({
              to: branchPlace({
                sessionId,
                mountPath: mount?.worktreePath ?? null,
                tab: 'pr',
              }),
            });
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'mark-ready') {
      return {
        primary: {
          label: 'Mark ready',
          isDisabled: false,
          failureTitle: prLifecycleFailureTitle({
            action: 'ready',
            prNumber: suggestion.payload.prNumber,
          }),
          run: () =>
            markPrReady(sessionId, suggestion.payload.prNumber, {
              mountId: suggestion.payload.mountId,
            }),
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'merge-pr') {
      return {
        primary: {
          label: 'Merge',
          isDisabled: false,
          requiresConfirm: true,
          failureTitle: prLifecycleFailureTitle({
            action: 'merge',
            prNumber: suggestion.payload.prNumber,
          }),
          run: () =>
            mergePr(sessionId, suggestion.payload.prNumber, suggestion.payload.defaultMethod, {
              mountId: suggestion.payload.mountId,
            }),
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'close-worktree') {
      const worktrees = suggestion.payload.worktrees;
      const isMany = worktrees.length > 1;
      return {
        primary: {
          label: isMany ? NAMES.removeWorktrees : NAMES.removeWorktree,
          shortLabel: 'Remove',
          isDisabled: false,
          requiresConfirm: true,
          failureTitle: isMany ? "Couldn't remove the worktrees" : "Couldn't remove the worktree",
          run: async () => {
            for (const worktree of worktrees) {
              await resolveMountCleanup({
                sessionId,
                requestId: worktree.requestId,
                decision: 'remove',
              });
            }
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'continue-with-workflow') {
      return {
        primary: {
          label: 'Set up',
          isDisabled: false,
          failureTitle: "Couldn't attach the workflow",
          run: async () => {
            await attachWorkflowToSession(sessionId, suggestion.payload.workflowId, {
              goal: session.goal,
              navigate: true,
            });
          },
        },
        onDismiss: null,
      };
    }
    return NO_ACTIONS;
  };
};
