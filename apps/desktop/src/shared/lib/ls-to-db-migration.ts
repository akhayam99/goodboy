import {
  archiveSession,
  getWorkspaceOverrides,
  setWorkspaceOverrides,
  updateSessionConfig,
  updateAgentConfig,
  getSetting,
  setSetting,
  getSessionById,
  getAgentById,
} from '@goodboy/db';
import type { OverrideSettings, SessionId, AgentId, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from './db';

const MIGRATED_MARKER = 'goodboy:ls-migrated-v1';
const LS_ARCHIVED = 'goodboy:archived-tasks';
const LS_ONBOARDING_PROGRESS = 'goodboy:onboarding-progress';
const LS_ONBOARDING_COLLAPSED = 'goodboy:onboarding-collapsed';
const LS_ONBOARDING_FINISHED = 'goodboy:onboarding-finished';

const PREFIX_WORKSPACE_VERBOSITY = 'goodboy:workspace-verbosity:';
const PREFIX_EFFORT = 'goodboy:effort:';
const PREFIX_MODEL = 'goodboy:model:';
const PREFIX_PROVIDER = 'goodboy:provider:';
const PREFIX_AGENT_EFFORT = 'goodboy:agent-effort:';
const PREFIX_AGENT_MODEL = 'goodboy:agent-model:';
const PREFIX_AGENT_PROVIDER = 'goodboy:agent-provider:';

const VERBOSITY_VALUES = ['brief', 'normal', 'verbose'] as const;
const EFFORT_VALUES = ['minimal', 'low', 'medium', 'high', 'extra-high', 'max'] as const;
const PROVIDER_VALUES = ['anthropic', 'cursor', 'codex', 'gemini', 'opencode'] as const;
const LEGACY_VERBOSITY_MAP: Record<string, 'brief' | 'normal' | 'verbose'> = {
  essential: 'brief',
  minimal: 'brief',
  detailed: 'verbose',
};

type Verbosity = (typeof VERBOSITY_VALUES)[number];
type Effort = (typeof EFFORT_VALUES)[number];
type ProviderLite = (typeof PROVIDER_VALUES)[number];

function normalizeVerbosity(raw: string | null): Verbosity | null {
  if (!raw) {
    return null;
  }
  if ((VERBOSITY_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as Verbosity;
  }
  return LEGACY_VERBOSITY_MAP[raw] ?? null;
}

function asEffort(raw: string | null): Effort | null {
  return raw && (EFFORT_VALUES as ReadonlyArray<string>).includes(raw) ? (raw as Effort) : null;
}

function asProviderId(raw: string | null): ProviderLite | null {
  return raw && (PROVIDER_VALUES as ReadonlyArray<string>).includes(raw)
    ? (raw as ProviderLite)
    : null;
}

async function migrateArchivedSessions(): Promise<void> {
  const raw = localStorage.getItem(LS_ARCHIVED);
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      for (const id of Object.keys(parsed as Record<string, unknown>)) {
        const session = await getSessionById(tauriDatabase, id as SessionId);
        if (session && !session.archivedAt) {
          await archiveSession(tauriDatabase, id as SessionId);
        }
      }
    }
  } catch {}
  localStorage.removeItem(LS_ARCHIVED);
}

async function migrateWorkspaceVerbosity(): Promise<void> {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX_WORKSPACE_VERBOSITY)) {
      keys.push(k);
    }
  }
  for (const key of keys) {
    const workspaceId = key.slice(PREFIX_WORKSPACE_VERBOSITY.length) as WorkspaceId;
    const value = normalizeVerbosity(localStorage.getItem(key));
    if (value) {
      const existing = await getWorkspaceOverrides(tauriDatabase, workspaceId);
      if (existing && existing.defaultVerbosity == null) {
        const next: OverrideSettings = { ...existing, defaultVerbosity: value };
        await setWorkspaceOverrides(tauriDatabase, workspaceId, next);
      }
    }
    localStorage.removeItem(key);
  }
}

async function migrateSessionConfig(): Promise<void> {
  const collected = new Map<
    SessionId,
    { effort?: Effort; modelOverride?: string; providerOverride?: ProviderLite }
  >();
  const keysToDrop: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) {
      continue;
    }
    if (k.startsWith(PREFIX_EFFORT)) {
      const id = k.slice(PREFIX_EFFORT.length) as SessionId;
      const v = asEffort(localStorage.getItem(k));
      if (v) {
        collected.set(id, { ...(collected.get(id) ?? {}), effort: v });
      }
      keysToDrop.push(k);
    } else if (k.startsWith(PREFIX_MODEL)) {
      const id = k.slice(PREFIX_MODEL.length) as SessionId;
      const v = localStorage.getItem(k);
      if (v) {
        collected.set(id, { ...(collected.get(id) ?? {}), modelOverride: v });
      }
      keysToDrop.push(k);
    } else if (k.startsWith(PREFIX_PROVIDER)) {
      const id = k.slice(PREFIX_PROVIDER.length) as SessionId;
      const v = asProviderId(localStorage.getItem(k));
      if (v) {
        collected.set(id, { ...(collected.get(id) ?? {}), providerOverride: v });
      }
      keysToDrop.push(k);
    }
  }
  for (const [id, fields] of collected) {
    const session = await getSessionById(tauriDatabase, id);
    if (!session) {
      continue;
    }
    const update: { effort?: Effort; modelOverride?: string; providerOverride?: string } = {};
    if (fields.effort && !session.effort) {
      update.effort = fields.effort;
    }
    if (fields.modelOverride && !session.modelOverride) {
      update.modelOverride = fields.modelOverride;
    }
    if (fields.providerOverride && !session.providerOverride) {
      update.providerOverride = fields.providerOverride;
    }
    if (Object.keys(update).length > 0) {
      await updateSessionConfig(tauriDatabase, id, update);
    }
  }
  for (const k of keysToDrop) localStorage.removeItem(k);
}

async function migrateAgentConfig(): Promise<void> {
  const collected = new Map<
    AgentId,
    { effort?: Effort; modelOverride?: string; providerOverride?: ProviderLite }
  >();
  const keysToDrop: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) {
      continue;
    }
    if (k.startsWith(PREFIX_AGENT_EFFORT)) {
      const id = k.slice(PREFIX_AGENT_EFFORT.length) as AgentId;
      const v = asEffort(localStorage.getItem(k));
      if (v) {
        collected.set(id, { ...(collected.get(id) ?? {}), effort: v });
      }
      keysToDrop.push(k);
    } else if (k.startsWith(PREFIX_AGENT_MODEL)) {
      const id = k.slice(PREFIX_AGENT_MODEL.length) as AgentId;
      const v = localStorage.getItem(k);
      if (v) {
        collected.set(id, { ...(collected.get(id) ?? {}), modelOverride: v });
      }
      keysToDrop.push(k);
    } else if (k.startsWith(PREFIX_AGENT_PROVIDER)) {
      const id = k.slice(PREFIX_AGENT_PROVIDER.length) as AgentId;
      const v = asProviderId(localStorage.getItem(k));
      if (v) {
        collected.set(id, { ...(collected.get(id) ?? {}), providerOverride: v });
      }
      keysToDrop.push(k);
    }
  }
  for (const [id, fields] of collected) {
    const agent = await getAgentById(tauriDatabase, id);
    if (!agent) {
      continue;
    }
    const update: { effort?: Effort; modelOverride?: string; providerOverride?: ProviderLite } = {};
    if (fields.effort && !agent.effort) {
      update.effort = fields.effort;
    }
    if (fields.modelOverride && !agent.modelOverride) {
      update.modelOverride = fields.modelOverride;
    }
    if (fields.providerOverride && !agent.providerOverride) {
      update.providerOverride = fields.providerOverride;
    }
    if (Object.keys(update).length > 0) {
      await updateAgentConfig(tauriDatabase, id, update);
    }
  }
  for (const k of keysToDrop) localStorage.removeItem(k);
}

async function migrateOnboarding(): Promise<void> {
  const rawProgress = localStorage.getItem(LS_ONBOARDING_PROGRESS);
  if (rawProgress) {
    const existing = await getSetting(tauriDatabase, 'onboarding.progress');
    if (!existing) {
      await setSetting(tauriDatabase, 'onboarding.progress', rawProgress);
    }
    localStorage.removeItem(LS_ONBOARDING_PROGRESS);
  }
  const collapsed = localStorage.getItem(LS_ONBOARDING_COLLAPSED) === '1';
  const finished = localStorage.getItem(LS_ONBOARDING_FINISHED) === '1';
  if (collapsed && !(await getSetting(tauriDatabase, 'onboarding.collapsed'))) {
    await setSetting(tauriDatabase, 'onboarding.collapsed', '1');
  }
  if (finished && !(await getSetting(tauriDatabase, 'onboarding.finished'))) {
    await setSetting(tauriDatabase, 'onboarding.finished', '1');
  }
  localStorage.removeItem(LS_ONBOARDING_COLLAPSED);
  localStorage.removeItem(LS_ONBOARDING_FINISHED);
}

export const migrateLsToDb = async (): Promise<void> => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  if (localStorage.getItem(MIGRATED_MARKER) === '1') {
    return;
  }
  try {
    await migrateArchivedSessions();
    await migrateWorkspaceVerbosity();
    await migrateSessionConfig();
    await migrateAgentConfig();
    await migrateOnboarding();
    localStorage.setItem(MIGRATED_MARKER, '1');
  } catch (err) {
    console.warn('[ls-to-db migration] failed', err);
  }
};
