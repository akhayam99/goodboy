import type {
  Session,
  WorkspaceId,
  SessionId,
  SessionExternalTask,
  TelemetrySummary,
  TelemetryRecord,
} from '@goodboy/types';

export type SessionLoadingFlags = {
  readonly agents: boolean;
  readonly transcript: boolean;
  readonly telemetry: boolean;
  readonly slots: boolean;
  readonly plans: boolean;
  readonly summary: boolean;
};

export type SessionsState = {
  readonly sessions: ReadonlyArray<Session>;
  readonly archivedSessions: Readonly<Record<WorkspaceId, ReadonlyArray<Session>>>;
  readonly currentSessionId: SessionId | null;
  readonly sessionExternalTasks: Readonly<Record<SessionId, ReadonlyArray<SessionExternalTask>>>;
  readonly sessionSummary: TelemetrySummary | null;
  readonly workspaceSummary: TelemetrySummary | null;
  readonly sessionTelemetry: Readonly<Record<string, ReadonlyArray<TelemetryRecord>>>;
  readonly sessionLoading: Readonly<Record<SessionId, SessionLoadingFlags>>;
};

export const sessionsInitialState: SessionsState = {
  sessions: [],
  archivedSessions: {},
  currentSessionId: null,
  sessionExternalTasks: {},
  sessionSummary: null,
  workspaceSummary: null,
  sessionTelemetry: {},
  sessionLoading: {},
};
