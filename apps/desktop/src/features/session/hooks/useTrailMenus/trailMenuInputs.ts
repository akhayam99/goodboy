import type {
  Agent,
  AgentId,
  ArtifactId,
  PullRequestState,
  ResolveAttempt,
  Session,
  SessionArtifact,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import type { useCopyLink } from '@goodboy/ui';
import type { useAppStore, useMountDiffStats } from '../../../../store';
import type { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import type { ResolveQueueRow } from '../../../resolve/buildResolveQueueRows';
import type { AgentLifecycleSignals } from '../useAgentLifecycleSignals';
import type { LensDestination } from '../../lens-destinations';
import type { PageSummaries } from '../../pageCountWord';
import type { SelectedWorkflowRun } from '../useSelectedWorkflowRun';
import type { useWorktreeStatuses } from '../useWorktreeStatuses';

type StoreState = ReturnType<typeof useAppStore.getState>;

type TrailMenuStoreActions = Pick<
  StoreState,
  | 'navigate'
  | 'setFocusedWorkflowRun'
  | 'setFocusedArtifactId'
  | 'cancelCurrentTurn'
  | 'recoverStuckStep'
  | 'reportError'
  | 'selectSessionPr'
  | 'setPullRequestMode'
>;

export type TrailMenuInputs = TrailMenuStoreActions & {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly selectedAgentId: AgentId | null;
  readonly phaseRuns: ReadonlyArray<Agent>;
  readonly kindOverride: StoreState['agentKindOverride'];
  readonly focusedWorkflowRunId: string | null;
  readonly focusedArtifactId: ArtifactId | null;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly resolveAttempts: ReadonlyArray<ResolveAttempt>;
  readonly workspaceSlug: string | null;
  readonly signals: AgentLifecycleSignals;
  readonly attachedRuns: ReturnType<typeof useAttachedWorkflowRuns>;
  readonly selectedWorkflowRun: SelectedWorkflowRun | null;
  readonly destinations: ReadonlyArray<LensDestination>;
  readonly summaries: PageSummaries;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly diffPath: string | null;
  readonly diffStats: ReturnType<typeof useMountDiffStats>;
  readonly branchStatuses: ReturnType<typeof useWorktreeStatuses>;
  readonly mergedMountIds: ReadonlyArray<string>;
  readonly openRequestHeads: Readonly<Record<string, string>>;
  readonly queueRows: ReadonlyArray<ResolveQueueRow>;
  readonly resolveAgain: (params: {
    readonly threadId: string;
    readonly instruction: string;
  }) => Promise<unknown>;
  readonly prNumber: number | null;
  readonly selectedPrNumber: number | null;
  readonly pullRequests: ReadonlyArray<PullRequestState>;
  readonly threadId: string | null;
  readonly copy: ReturnType<typeof useCopyLink>['copy'];
};
