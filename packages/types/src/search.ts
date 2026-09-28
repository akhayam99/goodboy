import type { AgentId, IsoDateTime, MountId, ProjectId, SessionId, WorkspaceId } from './ids';

export const SEARCH_KINDS = [
  'session',
  'message',
  'agent',
  'plan',
  'report',
  'wireframe',
  'decision',
  'question',
  'issue',
  'pr',
  'branch',
] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

export const isSearchKind = (value: unknown): value is SearchKind =>
  typeof value === 'string' && SEARCH_KINDS.some((kind) => kind === value);

export type SearchArchived = 'exclude' | 'only' | 'include';

export type SearchQuery = Readonly<{
  text: string;
  kinds: ReadonlyArray<SearchKind>;
  workspaceId: WorkspaceId | null;
  sessionId: SessionId | null;
  projectIds: ReadonlyArray<ProjectId>;
  providers: ReadonlyArray<string>;
  statuses: ReadonlyArray<string>;
  after: number | null;
  before: number | null;
  archived: SearchArchived;
  limit: number;
}>;

export type MarkedSegment = Readonly<{
  text: string;
  isMatch: boolean;
}>;

export type SearchHit = Readonly<{
  docId: string;
  kind: SearchKind;
  refId: string;
  workspaceId: WorkspaceId | null;
  sessionId: SessionId | null;
  sessionTitle: string | null;
  agentId: AgentId | null;
  agentName: string | null;
  mountId: MountId | null;
  provider: string | null;
  container: string | null;
  status: string | null;
  ordinal: number | null;
  url: string | null;
  isArchived: boolean;
  occurredAt: IsoDateTime;
  title: ReadonlyArray<MarkedSegment>;
  snippet: ReadonlyArray<MarkedSegment>;
}>;

export type SearchIndexStatus = Readonly<{
  docs: number;
  bytes: number;
  scanned: number;
  total: number;
  isBackfillDone: boolean;
  excludedProjectIds: ReadonlyArray<ProjectId>;
}>;
