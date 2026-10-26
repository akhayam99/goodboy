import type { SearchHit, SearchQuery } from '@goodboy/types';
import { findTokens } from '../../../../../features/search/findInView/foldText';
import type { AppStore } from '../../../../../store/store';
import { markMatches } from './markMatches';

type Params = {
  readonly state: AppStore;
  readonly query: SearchQuery;
};

type TextParams = {
  readonly text: string;
  readonly tokens: ReadonlyArray<string>;
};

type KindParams = {
  readonly kind: SearchHit['kind'];
};

type SessionRow = AppStore['sessions'][number];

type SessionParams = {
  readonly session: SessionRow;
};

type VisibleParams = SessionParams & {
  readonly query: SearchQuery;
};

type DocParams = VisibleParams & {
  readonly provider: string;
  readonly status: string;
  readonly occurredAt: string;
};

const SNIPPET_LENGTH = 180;

const hasEveryToken = ({ text, tokens }: TextParams): boolean => {
  const lower = text.toLowerCase();
  return tokens.every((token) => lower.includes(token));
};

const snippetOf = ({ text, tokens }: TextParams): string => {
  const first = tokens.map((token) => text.toLowerCase().indexOf(token)).find((at) => at >= 0) ?? 0;
  const start = Math.max(0, first - 40);
  return text.slice(start, start + SNIPPET_LENGTH).trim();
};

const isArchivedSession = ({ session }: SessionParams): boolean => session.archivedAt !== undefined;

const isSessionVisible = ({ session, query }: VisibleParams): boolean => {
  if (session.deletedAt !== undefined) {
    return false;
  }
  if (query.archived === 'exclude' && isArchivedSession({ session })) {
    return false;
  }
  if (query.archived === 'only' && !isArchivedSession({ session })) {
    return false;
  }
  if (query.workspaceId !== null && query.workspaceId !== session.workspaceId) {
    return false;
  }
  if (query.projectIds.length > 0) {
    return (
      session.activeProjectId !== undefined && query.projectIds.includes(session.activeProjectId)
    );
  }
  return true;
};

const isDocMatching = ({ session, query, provider, status, occurredAt }: DocParams): boolean => {
  if (!isSessionVisible({ session, query })) {
    return false;
  }
  if (query.providers.length > 0 && !query.providers.includes(provider)) {
    return false;
  }
  const statuses = query.statuses.filter((value) => value !== 'archived');
  if (statuses.length > 0 && !statuses.includes(status)) {
    return false;
  }
  const at = Date.parse(occurredAt);
  if (query.after !== null && at < query.after) {
    return false;
  }
  return query.before === null || at < query.before;
};

export const runDemoSearch = ({ state, query }: Params): ReadonlyArray<SearchHit> => {
  const tokens = findTokens({ text: query.text });
  if (tokens.length === 0) {
    return [];
  }
  const isKindAllowed = ({ kind }: KindParams): boolean =>
    query.kinds.length === 0 || query.kinds.includes(kind);
  const hits: SearchHit[] = [];
  for (const session of state.sessions) {
    if (query.sessionId !== null && query.sessionId !== session.id) {
      continue;
    }
    if (!isSessionVisible({ session, query })) {
      continue;
    }
    const sessionProvider = session.providerOverride ?? session.providerPreference.defaultProvider;
    const isArchived = isArchivedSession({ session });
    const sessionStatus = isArchived ? 'archived' : session.state.kind;
    const isSessionHit =
      isKindAllowed({ kind: 'session' }) &&
      hasEveryToken({ text: session.goal, tokens }) &&
      isDocMatching({
        session,
        query,
        provider: sessionProvider,
        status: sessionStatus,
        occurredAt: session.updatedAt,
      });
    if (isSessionHit) {
      hits.push({
        docId: `session:${session.id}`,
        kind: 'session',
        refId: session.id,
        workspaceId: session.workspaceId,
        sessionId: session.id,
        sessionTitle: session.goal,
        agentId: null,
        agentName: null,
        mountId: null,
        provider: sessionProvider,
        container: null,
        status: sessionStatus,
        ordinal: null,
        url: null,
        isArchived,
        occurredAt: session.updatedAt,
        title: markMatches({ text: session.goal, tokens }),
        snippet: [],
      });
    }
    if (!isKindAllowed({ kind: 'message' })) {
      continue;
    }
    for (const agent of state.sessionPhaseRuns[session.id] ?? []) {
      const provider = agent.providerOverride ?? sessionProvider;
      for (const event of state.transcripts[agent.id] ?? []) {
        if (event.kind !== 'user_text' || !hasEveryToken({ text: event.text, tokens })) {
          continue;
        }
        const isMatch = isDocMatching({
          session,
          query,
          provider,
          status: agent.status,
          occurredAt: event.at,
        });
        if (!isMatch) {
          continue;
        }
        hits.push({
          docId: `message:${agent.id}:${event.runId}`,
          kind: 'message',
          refId: `${agent.id}:${event.runId}`,
          workspaceId: session.workspaceId,
          sessionId: session.id,
          sessionTitle: session.goal,
          agentId: agent.id,
          agentName: agent.name,
          mountId: null,
          provider,
          container: null,
          status: agent.status,
          ordinal: null,
          url: null,
          isArchived,
          occurredAt: event.at,
          title: markMatches({ text: session.goal, tokens }),
          snippet: markMatches({ text: snippetOf({ text: event.text, tokens }), tokens }),
        });
      }
    }
  }
  return hits.slice(0, query.limit);
};
