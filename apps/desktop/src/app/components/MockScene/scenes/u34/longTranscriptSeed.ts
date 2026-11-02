import {
  brandId,
  type Agent,
  type AgentId,
  type Project,
  type ProjectId,
  type ProviderRunId,
  type Session,
  type SessionId,
  type Workspace,
  type WorkspaceId,
} from '@goodboy/types';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-07T09:12:00.000Z' });

export const LONG_TRANSCRIPT_ROWS = 3000;

export const LONG_TRANSCRIPT_WORKSPACE_ID = brandId<WorkspaceId>({
  value: 'mock-long-transcript-workspace',
});
export const LONG_TRANSCRIPT_SESSION_ID = brandId<SessionId>({
  value: 'mock-long-transcript-session',
});
export const LONG_TRANSCRIPT_AGENT_ID = brandId<AgentId>({ value: 'mock-long-transcript-agent' });
const PROJECT_ID = brandId<ProjectId>({ value: 'mock-long-transcript-project' });
const RUN_ID = brandId<ProviderRunId>({ value: 'mock-long-transcript-run' });
const NOW = clock.iso({ at: '2026-09-07T09:12:00.000Z' });

const OVERRIDES = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

export const LONG_TRANSCRIPT_WORKSPACE: Workspace = {
  id: LONG_TRANSCRIPT_WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

export const LONG_TRANSCRIPT_PROJECTS: ReadonlyArray<Project> = [
  {
    id: PROJECT_ID,
    workspaceId: LONG_TRANSCRIPT_WORKSPACE_ID,
    name: 'ledger-core',
    rootPath: '~/code/harborline/ledger-core',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const LONG_TRANSCRIPT_SESSION: Session = {
  id: LONG_TRANSCRIPT_SESSION_ID,
  workspaceId: LONG_TRANSCRIPT_WORKSPACE_ID,
  goal: 'Replay a month of statement corrections',
  state: { kind: 'ended', endedAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

export const LONG_TRANSCRIPT_AGENT: Agent = {
  id: LONG_TRANSCRIPT_AGENT_ID,
  sessionId: LONG_TRANSCRIPT_SESSION_ID,
  name: 'Statement replay',
  kind: 'implementer',
  status: 'completed',
  ordinal: 1,
  lastFinishedAt: NOW,
  lastViewedAt: NOW,
};

type RowParams = {
  readonly index: number;
};

const rowOf = ({ index }: RowParams) => {
  if (index % 2 === 0) {
    return {
      kind: 'user_text' as const,
      runId: RUN_ID,
      text: `Statement ${index / 2 + 1}: replay the correction for Northwind and confirm the total.`,
      at: NOW,
    };
  }
  return {
    kind: 'assistant_text' as const,
    runId: RUN_ID,
    delta: `Replayed correction ${(index - 1) / 2 + 1} in ledger-core: the idempotency key travels with the retry and the corrected total matches.`,
    at: NOW,
  };
};

export const longTranscriptRows = () =>
  Array.from({ length: LONG_TRANSCRIPT_ROWS }, (_, index) => rowOf({ index }));
