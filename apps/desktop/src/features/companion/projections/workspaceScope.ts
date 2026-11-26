import type { PullRequestFacts } from '../../actions/kinds/pullRequestFacts';
import type {
  Agent,
  OpenQuestion,
  PullRequestState,
  Session,
  SessionExternalTask,
  SessionStageInfo,
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
}>;
