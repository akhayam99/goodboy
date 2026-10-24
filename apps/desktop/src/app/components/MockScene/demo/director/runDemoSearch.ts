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
    if (isKindAllowed({ kind: 'session' }) && hasEveryToken({ text: session.goal, tokens })) {
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
        provider: null,
        container: null,
        status: null,
        ordinal: null,
        url: null,
        isArchived: false,
        occurredAt: session.updatedAt,
        title: markMatches({ text: session.goal, tokens }),
        snippet: [],
      });
    }
    if (!isKindAllowed({ kind: 'message' })) {
      continue;
    }
    for (const agent of state.sessionPhaseRuns[session.id] ?? []) {
      for (const event of state.transcripts[agent.id] ?? []) {
        if (event.kind !== 'user_text' || !hasEveryToken({ text: event.text, tokens })) {
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
          provider: null,
          container: null,
          status: null,
          ordinal: null,
          url: null,
          isArchived: false,
          occurredAt: event.at,
          title: markMatches({ text: session.goal, tokens }),
          snippet: markMatches({ text: snippetOf({ text: event.text, tokens }), tokens }),
        });
      }
    }
  }
  return hits.slice(0, query.limit);
};
