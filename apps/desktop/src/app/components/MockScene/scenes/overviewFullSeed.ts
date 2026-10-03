import type {
  AgentId,
  ArtifactId,
  ChatId,
  ChatSessionLink,
  ChatSessionLinkId,
  ChatSummary,
  IsoDateTime,
  PlanArtifact,
  ReportArtifact,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

type SeedParams = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly now: IsoDateTime;
};

const RETRY_CHAT = 'mock-chat-payments-retry' as ChatId;
const ROUNDING_CHAT = 'mock-chat-ledger-rounding' as ChatId;

type ChatParams = SeedParams & {
  readonly id: ChatId;
  readonly title: string;
};

const chatOf = ({ workspaceId, now, id, title }: ChatParams): ChatSummary => ({
  id,
  workspaceId,
  title,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: null,
  pinnedAt: null,
  archivedAt: null,
  lastActivityAt: now,
  createdAt: now,
  updatedAt: now,
  preview: null,
  modelsUsed: [],
});

type LinkParams = SeedParams & {
  readonly chatId: ChatId;
  readonly kind: ChatSessionLink['kind'];
};

const linkOf = ({ sessionId, now, chatId, kind }: LinkParams): ChatSessionLink => ({
  id: `mock-link-${chatId}` as ChatSessionLinkId,
  chatId,
  sessionId,
  messageId: null,
  kind,
  createdAt: now,
});

type ArtifactParams = SeedParams & {
  readonly id: string;
  readonly title: string;
};

const base = ({ sessionId, now, id, title }: ArtifactParams) => ({
  id: id as ArtifactId,
  sessionId,
  agentId: 'mock-mounts-agent-planner' as AgentId,
  workflowRunId: null,
  schemaVersion: 1,
  title,
  sourceText: '',
  status: 'active' as const,
  revision: 1,
  sourceTurnId: null,
  createdAt: now,
  updatedAt: now,
});

export const overviewFullSeed = (params: SeedParams) => {
  const plan: PlanArtifact = {
    ...base({ ...params, id: 'mock-artifact-plan', title: 'Show the attempts on each delivery' }),
    kind: 'plan',
    sourceFormat: 'markdown',
    metadata: {},
  };
  const report: ReportArtifact = {
    ...base({
      ...params,
      id: 'mock-artifact-report',
      title: 'Webhook redelivery no longer double credits',
    }),
    kind: 'report',
    sourceFormat: 'markdown',
    metadata: { reportType: 'summary' },
  };
  return {
    chatsByWorkspace: {
      [params.workspaceId]: [
        chatOf({ ...params, id: RETRY_CHAT, title: 'Payments retry design' }),
        chatOf({ ...params, id: ROUNDING_CHAT, title: 'Ledger rounding' }),
      ],
    },
    archivedChatsByWorkspace: { [params.workspaceId]: [] },
    chatLinks: {
      [RETRY_CHAT]: [linkOf({ ...params, chatId: RETRY_CHAT, kind: 'new' })],
      [ROUNDING_CHAT]: [linkOf({ ...params, chatId: ROUNDING_CHAT, kind: 'add' })],
    },
    sessionArtifacts: { [params.sessionId]: [plan, report] },
  };
};
