import { useEffect } from 'react';
import type {
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { BRAND_TODAY_USD } from './canon';
import { seedBrandLimits } from './limitsSeed';

const FILLER_ID = 'brand-today-filler' as TelemetryRecordId;
const GHOST_ID = 'brand-ghost-session' as SessionId;
const PASSES_MS = [250, 900, 1800, 3000];
const QUIET_GOALS: ReadonlyArray<string> = [
  'Bump the lockfile after the security patch',
  'Retire the legacy export cron job',
];

const startOfToday = (): string => {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  return day.toISOString();
};

const naturalToday = (records: ReadonlyArray<TelemetryRecord>, cutoff: string): number =>
  records
    .filter((rec) => rec.id !== FILLER_ID && rec.kind !== 'summarizer' && rec.recordedAt >= cutoff)
    .reduce((sum, rec) => sum + rec.estimatedCostUsd, 0);

const ghostSession = (workspaceId: Session['workspaceId']): Session => {
  const at = new Date(Date.now() - 26 * 3_600_000).toISOString() as IsoDateTime;
  return {
    id: GHOST_ID,
    workspaceId,
    goal: 'Retire the legacy export cron job',
    state: { kind: 'ended', endedAt: at },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
    permissionMode: 'default',
    workflowRuns: [],
    autoRun: false,
    titleUserEdited: true,
    createdAt: at,
    updatedAt: at,
  };
};

const topUpToday = (): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId == null) {
    return;
  }
  let sessions = state.sessions.filter((session) => session.workspaceId === workspaceId);
  if (sessions.length === 0) {
    const ghost = ghostSession(workspaceId);
    useAppStore.setState({ sessions: [...state.sessions, ghost] });
    sessions = [ghost];
  }
  const cutoff = startOfToday();
  const natural = sessions.reduce(
    (sum, session) => sum + naturalToday(state.sessionTelemetry[session.id] ?? [], cutoff),
    0,
  );
  const gap = Math.round((BRAND_TODAY_USD - natural) * 1000) / 1000;
  const target =
    sessions.find((session) => QUIET_GOALS.includes(session.goal)) ??
    sessions.find(
      (session) => session.state.kind === 'ended' && session.id !== state.currentSessionId,
    ) ??
    [...sessions].reverse().find((session) => session.id !== state.currentSessionId) ??
    sessions[0]!;
  const current = (state.sessionTelemetry[target.id] ?? []).filter((rec) => rec.id !== FILLER_ID);
  const filler: TelemetryRecord = {
    id: FILLER_ID,
    runId: 'brand-today-filler-run' as ProviderRunId,
    sessionId: target.id,
    kind: 'turn',
    provider: 'codex',
    model: 'gpt-5.6-sol',
    recordedAt: new Date(Date.now() - 60_000).toISOString() as IsoDateTime,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: gap,
  };
  useAppStore.setState({
    sessionTelemetry: {
      ...useAppStore.getState().sessionTelemetry,
      [target.id]: gap > 0.004 ? [...current, filler] : current,
    },
  });
};

const seedLimitsIfMissing = (): void => {
  const state = useAppStore.getState();
  if (state.providerLimits?.['anthropic'] != null) {
    return;
  }
  const providers = state.providers;
  seedBrandLimits();
  if (providers.length > 0) {
    useAppStore.setState({ providers });
  }
};

const hideUnknownSync = (): void => {
  document.querySelectorAll<HTMLElement>('[data-testid="project-sync-trigger"]').forEach((node) => {
    node.style.visibility = node.textContent?.trim() === '--' ? 'hidden' : '';
  });
};

export const useBrandChrome = ({ isBrand }: { readonly isBrand: boolean }): void => {
  useEffect(() => {
    if (!isBrand) {
      return;
    }
    const timers = PASSES_MS.map((ms) =>
      window.setTimeout(() => {
        seedLimitsIfMissing();
        topUpToday();
      }, ms),
    );
    const observer = new MutationObserver(hideUnknownSync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, [isBrand]);
};
