import type {
  AgentId,
  IsoDateTime,
  MarkedSegment,
  SearchHit,
  SearchKind,
  SearchQuery,
  SessionId,
} from '@goodboy/types';
import { findTokens } from '../../../../../features/search/findInView/foldText';
import {
  CHAT_AGENT_RESOLVER_ID,
  CHAT_SESSION_ID,
  EARLIER,
  EXPORT_SESSION_ID,
  NOW,
  WORKSPACE_ID,
} from '../flow-audit/fixtures';

type MockDoc = {
  readonly id: string;
  readonly kind: SearchKind;
  readonly sessionId: SessionId;
  readonly sessionTitle: string;
  readonly agentId: AgentId | null;
  readonly agentName: string | null;
  readonly provider: string | null;
  readonly container: string | null;
  readonly status: string | null;
  readonly ordinal: number | null;
  readonly isArchived: boolean;
  readonly occurredAt: IsoDateTime;
  readonly title: string;
  readonly body: string;
};

const WEBHOOKS = 'Stop retried webhooks posting a second credit';
const RESOLVER = 'Resolve review on payments-api#318';

const base = {
  sessionId: CHAT_SESSION_ID,
  sessionTitle: WEBHOOKS,
  agentId: null,
  agentName: null,
  provider: null,
  container: null,
  status: null,
  ordinal: null,
  isArchived: false,
  occurredAt: NOW,
} as const;

const DOCS: ReadonlyArray<MockDoc> = [
  {
    ...base,
    id: 'message:user-1',
    kind: 'message',
    agentId: CHAT_AGENT_RESOLVER_ID,
    agentName: RESOLVER,
    provider: 'anthropic',
    status: 'user',
    title: '',
    body: 'Retried webhooks post a second credit. Find where, then clean up the review on payments-api#318.',
  },
  {
    ...base,
    id: 'message:plan-1',
    kind: 'message',
    agentId: CHAT_AGENT_RESOLVER_ID,
    agentName: RESOLVER,
    provider: 'anthropic',
    status: 'assistant',
    title: '',
    body: 'The second credit is not in ledger-core. The handler checks for the event before the transaction opens, so a retry that lands mid-write slips past it and posts again.',
  },
  {
    ...base,
    id: 'session:webhooks',
    kind: 'session',
    title: WEBHOOKS,
    body: '',
  },
  {
    ...base,
    id: 'artifact:plan-dedupe',
    kind: 'plan',
    agentId: CHAT_AGENT_RESOLVER_ID,
    agentName: RESOLVER,
    status: 'active',
    title: 'Dedupe on the event id',
    body: 'Keep the processor event id on every credit row. Check the event id inside the credit transaction, not in the handler.',
  },
  {
    ...base,
    id: 'decision:3',
    kind: 'decision',
    ordinal: 3,
    status: 'active',
    title: 'Dedupe on the event id inside the transaction',
    body: 'A retry that lands mid-transaction slips past a check in the handler.',
  },
  {
    ...base,
    id: 'task:webhooks:linear:har-231',
    kind: 'issue',
    provider: 'linear',
    container: 'HAR-231',
    title: 'HAR-231 Retried webhook posts a second credit',
    body: '',
  },
  {
    ...base,
    id: 'ghpr:payments-api:fix-webhook-credit',
    kind: 'pr',
    provider: 'github',
    container: 'harborline/payments-api',
    status: 'open',
    title: '#318 Dedupe webhook credits on the event id',
    body: 'fix/webhook-credit harborline/payments-api',
  },
  {
    ...base,
    id: 'session:export',
    kind: 'session',
    sessionId: EXPORT_SESSION_ID,
    sessionTitle: 'Add monthly ledger exports for the finance close',
    occurredAt: EARLIER,
    title: 'Add monthly ledger exports for the finance close',
    body: '',
  },
  {
    ...base,
    id: 'session:credit-old',
    kind: 'session',
    sessionId: 'mock-search-session-archived' as SessionId,
    sessionTitle: 'Backfill missing credit rows',
    isArchived: true,
    status: 'archived',
    occurredAt: EARLIER,
    title: 'Backfill missing credit rows',
    body: '',
  },
];

type MarkParams = {
  readonly text: string;
  readonly tokens: ReadonlyArray<string>;
};

const markText = ({ text, tokens }: MarkParams): ReadonlyArray<MarkedSegment> => {
  if (tokens.length === 0) {
    return text.length === 0 ? [] : [{ text, isMatch: false }];
  }
  const pattern = new RegExp(`\\b(${tokens.join('|')})[\\p{L}\\p{N}]*`, 'giu');
  const segments: MarkedSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) {
      segments.push({ text: text.slice(last, at), isMatch: false });
    }
    segments.push({ text: match[0], isMatch: true });
    last = at + match[0].length;
  }
  if (last < text.length) {
    segments.push({ text: text.slice(last), isMatch: false });
  }
  return segments;
};

type MatchParams = {
  readonly doc: MockDoc;
  readonly query: SearchQuery;
  readonly tokens: ReadonlyArray<string>;
};

const matches = ({ doc, query, tokens }: MatchParams): boolean => {
  const words = findTokens({ text: `${doc.title} ${doc.body}` });
  const hasWords = tokens.every((token) => words.some((word) => word.startsWith(token)));
  const isKind = query.kinds.length === 0 || query.kinds.includes(doc.kind);
  const isProvider = query.providers.length === 0 || query.providers.includes(doc.provider ?? '');
  const isArchivedOk = query.archived === 'only' ? doc.isArchived : !doc.isArchived;
  const isSession = query.sessionId === null || query.sessionId === doc.sessionId;
  return hasWords && isKind && isProvider && isArchivedOk && isSession;
};

type RunParams = {
  readonly query: SearchQuery;
};

export const mockRunSearch = async ({ query }: RunParams): Promise<ReadonlyArray<SearchHit>> => {
  const tokens = findTokens({ text: query.text });
  return DOCS.filter((doc) => matches({ doc, query, tokens })).map((doc) => ({
    docId: doc.id,
    kind: doc.kind,
    refId: doc.id,
    workspaceId: WORKSPACE_ID,
    sessionId: doc.sessionId,
    sessionTitle: doc.sessionTitle,
    agentId: doc.agentId,
    agentName: doc.agentName,
    mountId: null,
    provider: doc.provider,
    container: doc.container,
    status: doc.status,
    ordinal: doc.ordinal,
    url: null,
    isArchived: doc.isArchived,
    occurredAt: doc.occurredAt,
    title: markText({ text: doc.title, tokens }),
    snippet: markText({ text: doc.body, tokens }),
  }));
};
