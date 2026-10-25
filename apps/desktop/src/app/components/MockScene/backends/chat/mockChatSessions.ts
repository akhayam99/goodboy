import type { IsoDateTime, ProviderRunId, Session, SessionId, WorkspaceId } from '@goodboy/types';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type MockChatSessionKey = 'consent' | 'rounding';

type IdParams = {
  readonly workspaceId: WorkspaceId;
  readonly key: MockChatSessionKey;
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly now?: number;
};

type AtParams = {
  readonly now: number;
  readonly agoMs: number;
};

const isoAgo = ({ now, agoMs }: AtParams): IsoDateTime =>
  new Date(now - agoMs).toISOString() as IsoDateTime;

export const mockChatSessionId = ({ workspaceId, key }: IdParams): SessionId =>
  `mock-chat-session-${workspaceId}-${key}` as SessionId;

export const mockChatSessions = ({
  workspaceId,
  now = Date.now(),
}: Params): ReadonlyArray<Session> => {
  const base = {
    workspaceId,
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
    permissionMode: 'default',
    workflowRuns: [],
    autoRun: false,
    titleUserEdited: true,
  } as const satisfies Partial<Session>;
  return [
    {
      ...base,
      id: mockChatSessionId({ workspaceId, key: 'consent' }),
      goal: 'Ask for consent again when the policy changes',
      state: {
        kind: 'running',
        runId: 'mock-chat-run-consent' as ProviderRunId,
        startedAt: isoAgo({ now, agoMs: 20 * MINUTE_MS }),
      },
      createdAt: isoAgo({ now, agoMs: 25 * MINUTE_MS }),
      updatedAt: isoAgo({ now, agoMs: 20 * MINUTE_MS }),
    },
    {
      ...base,
      id: mockChatSessionId({ workspaceId, key: 'rounding' }),
      goal: 'Round refunds half up in ledger-core',
      state: { kind: 'ended', endedAt: isoAgo({ now, agoMs: 2 * DAY_MS }) },
      createdAt: isoAgo({ now, agoMs: 4 * DAY_MS }),
      updatedAt: isoAgo({ now, agoMs: 2 * DAY_MS }),
    },
  ];
};
