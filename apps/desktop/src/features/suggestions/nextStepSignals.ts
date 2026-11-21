import type { AgentId, MountId, PlanId, ProjectId, SessionId } from '@goodboy/types';
import type { SuggestionMountEvent } from '../../store/slices/project-mounts/materializationProposals';
import type { SeriesStrip } from '../../store/slices/pr-series/seriesStripsOf';
import type { TrackerMove } from '../../store/slices/tracker-moves/types';
import type { ScriptGroup } from '../scripts/scripts';
import type { SettledBranches } from './archiveSuggestionOf';
import type {
  SuggestionAgent,
  SuggestionCheckChain,
  SuggestionCleanupProposal,
  SuggestionMount,
  SuggestionPlan,
  SuggestionProject,
  SuggestionRecommendedWorkflow,
  SuggestionWorkflowRun,
} from './deriveNextSteps';
import type { SuggestionKind, SuggestionQuestion } from './types';

export type SignalCheckLog = {
  readonly detailsUrl: string;
  readonly status: 'ready' | 'none';
  readonly fetchedAt: string;
  readonly testFile: string | null;
  readonly testName: string | null;
  readonly isTimeout: boolean;
  readonly lines: ReadonlyArray<string>;
};

export type SignalScripts = {
  readonly mountId: MountId;
  readonly worktreePath: string;
  readonly groups: ReadonlyArray<ScriptGroup>;
};

export type SignalTurnFiles = {
  readonly mountId: MountId;
  readonly paths: ReadonlyArray<string>;
  readonly recordedAtMs: number;
};

export type SignalQuietAgent = {
  readonly agentId: AgentId;
  readonly label: string;
  readonly quietMs: number;
};

export type SignalScriptRun = {
  readonly mountId: MountId | null;
  readonly name: string;
  readonly isOk: boolean;
  readonly completedAt: number;
};

export type SignalMergedMount = {
  readonly mountId: MountId;
  readonly projectName: string;
  readonly branch: string;
  readonly prNumber: number;
  readonly mergedAt: string | null;
  readonly requestId: string;
  readonly isProposed: boolean;
};

export type SignalIdleMount = {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly branch: string;
  readonly isRepo: boolean;
  readonly isClean: boolean;
  readonly hasUnpushedWork: boolean;
  readonly hasOpenPr: boolean;
  readonly lastTouchedMs: number | null;
  readonly requestId: string;
  readonly isProposed: boolean;
};

export type NextStepSignals = {
  readonly sessionId: SessionId;
  readonly workflowRuns: ReadonlyArray<SuggestionWorkflowRun>;
  readonly plans: ReadonlyArray<SuggestionPlan>;
  readonly consumedPlanIds: ReadonlySet<PlanId>;
  readonly openQuestionCount: number;
  readonly firstOpenQuestion?: SuggestionQuestion | null;
  readonly questionsRootAgentId?: AgentId | null;
  readonly hasPullRequest: boolean;
  readonly eligibleThreadCount: number;
  readonly projects: ReadonlyArray<SuggestionProject>;
  readonly mountEvents: ReadonlyArray<SuggestionMountEvent>;
  readonly agents?: ReadonlyArray<SuggestionAgent>;
  readonly mounts?: ReadonlyArray<SuggestionMount>;
  readonly cleanupProposals?: ReadonlyArray<SuggestionCleanupProposal>;
  readonly trackerMoves?: ReadonlyArray<TrackerMove>;
  readonly seriesStrips?: ReadonlyArray<SeriesStrip>;
  readonly settledBranches?: SettledBranches;
  readonly checkChains?: ReadonlyArray<SuggestionCheckChain>;
  readonly isActivityShown?: boolean;
  readonly hasGoal?: boolean;
  readonly hasEverAttachedWorkflow?: boolean;
  readonly recommendedWorkflow?: SuggestionRecommendedWorkflow | null;
  readonly now?: () => number;
  readonly dismissedFingerprints?: ReadonlySet<string>;
  readonly demotedKinds?: ReadonlySet<SuggestionKind>;
  readonly checkLogs?: ReadonlyArray<SignalCheckLog>;
  readonly scripts?: ReadonlyArray<SignalScripts>;
  readonly turnFiles?: ReadonlyArray<SignalTurnFiles>;
  readonly quietAgents?: ReadonlyArray<SignalQuietAgent>;
  readonly scriptRuns?: ReadonlyArray<SignalScriptRun>;
  readonly mergedMounts?: ReadonlyArray<SignalMergedMount>;
  readonly idleMounts?: ReadonlyArray<SignalIdleMount>;
};
