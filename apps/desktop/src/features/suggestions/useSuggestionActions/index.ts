import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, ResolveThread, Session, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, agentPlace, sessionPlace } from '../../../store';
import { sessionResolveStyle } from '../../../store/sessionReplySettings';
import { isMountCompleted } from '../../../store/slices/project-mounts/mountRowModel';
import { distanceBehind } from '../../../shared/lib/gitStatus';
import { useAgentStartedToast } from '../../../shared/hooks/useAgentStartedToast';
import { useSessionRoleModels } from '../../../shared/hooks/useSessionRoleModels';
import { launchChoiceOf } from '../../resolve/launchChoice';
import { startResolve } from '../../resolve/startResolve';
import { kindRouting } from '../../session/agent-kind';
import { REBASE_FAILURE_TITLE, useRebaseBranch } from '../../session/hooks/useRebaseBranch';
import { useWorktreeStatuses } from '../../session/hooks/useWorktreeStatuses';
import { useAdvanceWorkflowAgent } from '../../workflows/useAdvanceWorkflowAgent';
import { draftFixesLabel } from '../../actions/kinds/review';
import { prLifecycleFailureTitle } from '../../review/prLifecycle';
import { eligibleReviewThreads } from '../eligibleThreads';
import { useMountProposalActions } from '../useMountProposalActions';
import { useOpenAgentQuestion } from '../../context/hooks/useOpenAgentQuestion';
import type { RebaseSuggestionTarget, SessionSuggestion } from '../types';

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
  readonly isDisabled: boolean;
  readonly failureTitle: string;
  readonly run: () => Promise<void>;
  readonly choices?: ReadonlyArray<SuggestionActionChoice>;
  readonly requiresConfirm?: boolean;
};

export type SuggestionActionChoice = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly detail: string;
  readonly run: () => Promise<void>;
};

export type SuggestionActions = {
  readonly primary: SuggestionAction | null;
  readonly onDismiss: (() => Promise<void>) | null;
};

export type SuggestionActionResolver = (params: {
  readonly suggestion: SessionSuggestion;
}) => SuggestionActions;

const NO_ACTIONS: SuggestionActions = { primary: null, onDismiss: null };
const EMPTY_ROWS: ReadonlyArray<ResolveThread> = [];

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
  const github = useAppStore((state) => state.sessionGithub[sessionId] ?? null);
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
  const roleModels = useSessionRoleModels({ sessionId });
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const setAgentConfig = useAppStore((state) => state.setAgentConfig);
  const createResolveBatch = useAppStore((state) => state.createResolveBatch);
  const resolveStyle = useAppStore(
    useShallow((state) => sessionResolveStyle({ state, sessionId })),
  );
  const rows = useAppStore((state) => state.sessionResolveThreads[sessionId] ?? EMPTY_ROWS);
  const navigate = useAppStore((state) => state.navigate);
  const advanceAgent = useAdvanceWorkflowAgent({ sessionId });
  const proposalActions = useMountProposalActions({ sessionId });
  const runPlan = useAppStore((state) => state.runPlan);
  const pushSessionBranch = useAppStore((state) => state.pushSessionBranch);
  const openRewriteHistory = useAppStore((state) => state.openRewriteHistory);
  const createPrForSession = useAppStore((state) => state.createPrForSession);
  const markPrReady = useAppStore((state) => state.markPrReady);
  const mergePr = useAppStore((state) => state.mergePr);
  const resolveMountCleanup = useAppStore((state) => state.resolveMountCleanup);
  const attachWorkflowToSession = useAppStore((state) => state.attachWorkflowToSession);
  const announceAgentStarted = useAgentStartedToast();

  const rebaseMounts = useMemo(
    () => mounts.filter((mount) => !completedMountIds.includes(mount.mountId)),
    [completedMountIds, mounts],
  );

  const targets = useMemo(
    () =>
      rebaseMounts.map((mount) => ({
        worktreePath: mount.worktreePath,
        baseBranch:
          projects.find((project) => project.id === mount.projectId)?.baseBranch ?? undefined,
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

  const unresolvedThreads = useMemo(() => eligibleReviewThreads({ github, rows }), [github, rows]);

  const pullRequest = github?.pr ?? null;
  const startResolving = async (): Promise<void> => {
    if (pullRequest == null || unresolvedThreads.length === 0) {
      return;
    }
    const launchChoice = launchChoiceOf({
      routing: kindRouting({ kind: 'resolver', roleModels }),
      commitStyle: resolveStyle.commitStyle,
      hint: null,
    });
    const batch = await createResolveBatch({
      sessionId,
      threadIds: unresolvedThreads.flatMap((thread) =>
        thread.head.threadId == null ? [] : [thread.head.threadId],
      ),
      launchChoice,
    });
    await startResolve({
      sessionId,
      threads: unresolvedThreads,
      pr: pullRequest,
      batch: { batchId: batch.id, launchChoice },
      style: resolveStyle,
      spawnAgent,
      setAgentConfig,
    });
    navigate({ to: sessionPlace({ sessionId, lens: 'review' }) });
  };

  const startRebase = ({ target }: StartRebaseParams): Promise<void> =>
    rebase.run({ mountId: target.mountId, behind: target.behind });

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
          label: draftFixesLabel({ fresh: unresolvedThreads.length }),
          isDisabled: false,
          failureTitle: "The fix didn't start",
          run: startResolving,
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'rebase-project') {
      const firstTarget = suggestion.payload.targets[0] ?? null;
      return {
        primary: {
          label: rebase.isRunning ? 'Rebasing' : 'Rebase',
          isDisabled: firstTarget == null || rebase.isRunning,
          failureTitle: REBASE_FAILURE_TITLE,
          run: async () => {
            if (firstTarget == null) {
              return;
            }
            await startRebase({ target: firstTarget });
          },
          choices:
            suggestion.payload.targets.length > 1
              ? suggestion.payload.targets.map((target) => ({
                  id: target.id,
                  label: target.projectName,
                  description: target.branch,
                  detail: `${target.behind} behind`,
                  run: () => startRebase({ target }),
                }))
              : undefined,
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'plan-ready') {
      return {
        primary: {
          label: 'Start implementer',
          isDisabled: false,
          failureTitle: "Couldn't start the implementer",
          run: async () => {
            const agentId = await runPlan(sessionId, suggestion.payload.planId);
            announceAgentStarted({
              sessionId,
              agentId,
              title: 'Implementer started',
              message: 'An agent is running this plan. You can keep working.',
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
    if (suggestion.kind === 'retry-agent') {
      return {
        primary: {
          label: 'Retry',
          isDisabled: false,
          failureTitle: "Couldn't retry",
          run: async () => {
            await spawnAgent(sessionId, {
              kindOverride: suggestion.payload.agentKind,
              focus: 'none',
            });
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'check-changes') {
      return {
        primary: {
          label: 'Start reviewer',
          isDisabled: false,
          failureTitle: "Couldn't start the reviewer",
          run: async () => {
            await spawnAgent(sessionId, { kindOverride: 'reviewer', focus: 'none' });
          },
          choices: [
            {
              id: 'start-tester',
              label: 'Start tester instead',
              description: 'Writes tests for the changes',
              detail: '',
              run: async () => {
                await spawnAgent(sessionId, { kindOverride: 'tester', focus: 'none' });
              },
            },
          ],
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'fix-checks') {
      return {
        primary: {
          label: 'Start debugger',
          isDisabled: false,
          failureTitle: "Couldn't start the debugger",
          run: async () => {
            await spawnAgent(sessionId, {
              kindOverride: 'debugger',
              mountId: suggestion.payload.mountId,
              focus: 'none',
            });
          },
        },
        onDismiss: null,
      };
    }
    if (suggestion.kind === 'push-branch' && suggestion.payload.state === 'diverged') {
      return {
        primary: {
          label: 'Review history',
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
      return {
        primary: {
          label: 'Open PR',
          isDisabled: false,
          failureTitle: "Couldn't create the pull request",
          run: () => createPrForSession({ sessionId, mountId: suggestion.payload.mountId }),
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
      return {
        primary: {
          label: 'Close worktree',
          isDisabled: false,
          requiresConfirm: true,
          failureTitle: "Couldn't close the worktree",
          run: () =>
            resolveMountCleanup({
              sessionId,
              requestId: suggestion.payload.requestId,
              decision: 'remove',
            }),
        },
        onDismiss: () =>
          resolveMountCleanup({
            sessionId,
            requestId: suggestion.payload.requestId,
            decision: 'keep',
          }),
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
