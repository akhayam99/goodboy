import { invoke } from '@tauri-apps/api/core';
import {
  migrate as runMigrations,
  type Database,
  type MigrateResult,
  type TelemetrySummary,
} from '@kay-am/db';
import type {
  Agent,
  AgentId,
  AgentStatus,
  ContextSlot,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  StepId,
} from '@kay-am/types';

export const tauriDatabase: Database = {
  async exec(sql) {
    await invoke('db_exec', { sql });
  },
  async execute(sql, params = []) {
    return invoke<{ rowsAffected: number }>('db_execute', {
      sql,
      params: [...params],
    });
  },
  async select<T>(sql: string, params: ReadonlyArray<unknown> = []) {
    return invoke('db_select', {
      sql,
      params: [...params],
    }) as Promise<ReadonlyArray<T>>;
  },
};

export async function runDbMigrations(): Promise<MigrateResult> {
  return runMigrations(tauriDatabase);
}

export async function wipeDb(): Promise<MigrateResult> {
  await invoke('db_wipe');
  return runMigrations(tauriDatabase);
}

export interface SessionHydration {
  agents: ReadonlyArray<Record<string, unknown>>;
  agent_run_ids: ReadonlyArray<{ agent_id: string; run_ids: string | null }>;
  telemetry_summary: { input: number; output: number; cost: number; count: number };
  slots: ReadonlyArray<Record<string, unknown>>;
}

async function sessionHydrateRaw(sessionId: string): Promise<SessionHydration> {
  return invoke<SessionHydration>('session_hydrate', { sessionId });
}

export interface ParsedSessionHydration {
  agents: ReadonlyArray<Agent>;
  agentRunIds: Map<AgentId, ReadonlyArray<ProviderRunId>>;
  telemetrySummary: TelemetrySummary;
  slots: ReadonlyArray<ContextSlot>;
}

function parseAgent(r: Record<string, unknown>): Agent {
  return {
    id: r.id as AgentId,
    sessionId: r.sessionId as SessionId,
    ...(r.stepId != null && { stepId: r.stepId as StepId }),
    ordinal: r.ordinal as number,
    name: r.name as string,
    status: r.status as AgentStatus,
    ...(r.providerRunId != null && { runId: r.providerRunId as ProviderRunId }),
    ...(r.outputSummary != null && { outputSummary: r.outputSummary as string }),
    ...(r.startedAt != null && { startedAt: r.startedAt as IsoDateTime }),
    ...(r.completedAt != null && { completedAt: r.completedAt as IsoDateTime }),
    ...(r.providerSessionId != null && { providerSessionId: r.providerSessionId as string }),
    ...(r.lastFinishedAt != null && { lastFinishedAt: r.lastFinishedAt as IsoDateTime }),
    ...(r.lastViewedAt != null && { lastViewedAt: r.lastViewedAt as IsoDateTime }),
  };
}

function parseSlot(r: Record<string, unknown>): ContextSlot {
  return {
    key: r.key as string,
    value: r.value as string,
    enabled: r.enabled === 1,
  };
}

export async function sessionHydrate(sessionId: string): Promise<ParsedSessionHydration> {
  const raw = await sessionHydrateRaw(sessionId);

  const agentRunIds = new Map<AgentId, ReadonlyArray<ProviderRunId>>();
  for (const row of raw.agent_run_ids) {
    const agentId = row.agent_id as AgentId;
    const ids = row.run_ids ? (row.run_ids.split(',') as ProviderRunId[]) : [];
    agentRunIds.set(agentId, ids);
  }

  return {
    agents: raw.agents.map(parseAgent),
    agentRunIds,
    telemetrySummary: {
      inputTokens: raw.telemetry_summary.input ?? 0,
      outputTokens: raw.telemetry_summary.output ?? 0,
      estimatedCostUsd: raw.telemetry_summary.cost ?? 0,
      recordCount: raw.telemetry_summary.count ?? 0,
    },
    slots: raw.slots.map(parseSlot),
  };
}
