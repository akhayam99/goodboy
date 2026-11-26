import type { AutoLevel } from '@goodboy/core/auto';
import type { PullRequestFacts } from '../../actions/kinds/pullRequestFacts';
import type { MergeTrain } from '../../../store/slices/pr-series/mergeTrain';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import type {
  Agent,
  IntegrationDraft,
  OpenQuestion,
  PullRequestState,
  Session,
  SessionBudget,
  SessionDecision,
  SessionExternalTask,
  SessionStageInfo,
  TelemetryRecord,
  TurnEvent,
  TurnState,
  Workspace,
} from '@goodboy/types';

export type ReadyLine = Readonly<{
  sessionId: string;
  prNumber: number;
  headSha: string;
  title: string;
  repo: string;
  reason: string | null;
}>;

export type LineStats = Readonly<{ additions: number; deletions: number }>;

export type TaskFact = Readonly<{
  description: string | null;
  assignee: string | null;
  stateLabel: string | null;
}>;

export type PresetFact = Readonly<{ id: string; name: string }>;

export type ProjectFact = Readonly<{ id: string; name: string }>;

export type WorkspaceScope = Readonly<{
  workspace: Pick<Workspace, 'id' | 'name'>;
  sessions: ReadonlyArray<Session>;
  infos: Readonly<Record<string, SessionStageInfo>>;
  openQuestions: Readonly<Record<string, ReadonlyArray<OpenQuestion>>>;
  agents: Readonly<Record<string, ReadonlyArray<Agent>>>;
  projectNames: Readonly<Record<string, ReadonlyArray<string>>>;
  tasks: Readonly<Record<string, ReadonlyArray<SessionExternalTask>>>;
  pullRequests: Readonly<Record<string, PullRequestState | null>>;
  pullRequestFacts: Readonly<Record<string, PullRequestFacts | null>>;
  spendUsd: Readonly<Record<string, number>>;
  telemetry: Readonly<Record<string, ReadonlyArray<TelemetryRecord>>>;
  stepCounts?: Readonly<Record<string, number>>;
  agentRunHistory?: Readonly<Record<string, ReadonlyArray<string>>>;
  budgets: Readonly<Record<string, SessionBudget | undefined>>;
  slackDrafts: Readonly<Record<string, ReadonlyArray<IntegrationDraft>>>;
  trees: Readonly<Record<string, ReadonlyArray<AutoTreeView>>>;
  transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  turnStates: Readonly<Record<string, TurnState | undefined>>;
  decisions: Readonly<Record<string, ReadonlyArray<SessionDecision>>>;
  readyLines: ReadonlyArray<ReadyLine>;
  mergeTrain: MergeTrain | null;
  fileCounts: Readonly<Record<string, number | null>>;
  lineStats: Readonly<Record<string, LineStats | null>>;
  summaries: Readonly<Record<string, string>>;
  taskFacts: Readonly<Record<string, TaskFact>>;
  defaultLevel: AutoLevel;
  isOpen: boolean;
  presets: ReadonlyArray<PresetFact>;
  projects: ReadonlyArray<ProjectFact>;
  defaultLimitUsd: number | null;
}>;
