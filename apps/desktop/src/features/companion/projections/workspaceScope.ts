import type { PullRequestFacts } from '../../actions/kinds/pullRequestFacts';
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
  budgets: Readonly<Record<string, SessionBudget | undefined>>;
  slackDrafts: Readonly<Record<string, ReadonlyArray<IntegrationDraft>>>;
  trees: Readonly<Record<string, ReadonlyArray<AutoTreeView>>>;
  transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  turnStates: Readonly<Record<string, TurnState | undefined>>;
  decisions: Readonly<Record<string, ReadonlyArray<SessionDecision>>>;
}>;
