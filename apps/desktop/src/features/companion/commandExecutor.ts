import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  PROVIDER_CAPABILITIES,
  getDefaultTurnModel,
  isSlotKey,
  runsForWorkflowRun,
  type SlotKey,
} from '@goodboy/core';
import type {
  AgentId,
  AttachmentInput,
  ProviderId,
  SessionId,
  TurnProviderOverride,
} from '@goodboy/types';
import { useAppStore } from '../../store/store';
import { PROVIDER_LABEL_LOWER } from '../providers/providers';
import { isMainWindow } from '../workspace/window';
import { markSessionMobileShared } from './mobileConfinement';
import type { AgentKind } from '../session/agent-kind';

const PROVIDER_IDS: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex', 'gemini'];

// Context slots a phone may edit. `files_touched` is machine-derived (the turn
// loop owns it), so it's intentionally excluded from the writable set.
const MOBILE_EDITABLE_SLOTS: ReadonlySet<SlotKey> = new Set<SlotKey>([
  'goal',
  'decisions',
  'open_questions',
  'last_output_summary',
]);

const COMMAND_EVENT = 'bridge://command';

// Mirrors the Rust `CommandEvent` (bridge/commands.rs). `origin` is stamped
// server-side and is unforgeable; `data` is the phone's raw JSON — we read only
// the known keys below and never a path, cwd, provider, binary or flag.
type Origin = 'desktop' | 'mobile';
export type BridgeCommand = {
  readonly id: string;
  readonly kind: string;
  readonly origin: Origin;
  readonly data: unknown;
};

const MOBILE_AGENT_KINDS: ReadonlySet<string> = new Set([
  'planner',
  'implementer',
  'reviewer',
  'tester',
  'debugger',
  'scout',
  'resolver',
]);

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function requireSession(data: Record<string, unknown>): SessionId {
  const id = asString(data.sessionId);
  if (!id) {
    throw new Error('missing sessionId');
  }
  const known = useAppStore.getState().sessions.some((s) => s.id === id);
  if (!known) {
    throw new Error(`unknown session: ${id}`);
  }
  return id as SessionId;
}

// Phone-supplied attachments: keep only well-formed entries. Bytes land inside
// the worktree via `persistAttachments` (server-controlled path), never an
// arbitrary location the phone chooses.
function coerceAttachments(v: unknown): ReadonlyArray<AttachmentInput> {
  if (!Array.isArray(v)) {
    return [];
  }
  const out: AttachmentInput[] = [];
  for (const item of v) {
    const r = asRecord(item);
    const id = asString(r.id);
    const fileName = asString(r.fileName);
    const mimeType = asString(r.mimeType);
    const dataBase64 = asString(r.dataBase64);
    if (id && fileName && mimeType && dataBase64) {
      out.push({ id, fileName, mimeType, dataBase64 });
    }
  }
  return out;
}

// A phone-supplied provider/model pick. Validated against the closed provider
// set; an unknown id is dropped (the desktop falls back to its own routing).
function coerceOverride(data: Record<string, unknown>): TurnProviderOverride | undefined {
  const providerId = asString(data.providerId);
  if (!providerId || !PROVIDER_IDS.includes(providerId as ProviderId)) {
    return undefined;
  }
  const model = asString(data.model);
  return { providerId: providerId as ProviderId, ...(model ? { model } : {}) };
}

// The provider/model menu the phone's composer offers. Connection state comes
// from the live store (so the phone can grey out unavailable providers); the
// model list is the static registry, so the phone never hardcodes it.
function buildProviderMenu(): {
  providers: ReadonlyArray<{
    id: ProviderId;
    label: string;
    connection: string;
    defaultModel: string;
    models: ReadonlyArray<{ id: string; label: string; tier: string }>;
  }>;
} {
  const known = useAppStore.getState().providers;
  const providers = PROVIDER_IDS.map((id) => {
    const info = known.find((p) => p.id === id);
    return {
      id,
      label: info?.label ?? PROVIDER_LABEL_LOWER[id],
      connection: info?.connection ?? 'missing',
      defaultModel: getDefaultTurnModel(id),
      models: PROVIDER_CAPABILITIES[id].models.map((m) => ({
        id: m.id,
        label: m.label,
        tier: m.tier,
      })),
    };
  });
  return { providers };
}

// advanceStep: activate the next pending workflow agent whose predecessors are
// all done. Mirrors `maybeAutoAdvanceWorkflow`'s eligibility check, but here the
// human on the phone is explicitly advancing, so the autoRun gate doesn't apply.
async function advanceNextWorkflowStep(sessionId: SessionId): Promise<void> {
  const store = useAppStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session || session.workflowRuns.length === 0) {
    throw new Error('session has no workflow to advance');
  }
  const templates = store.phaseTemplates[session.workspaceId] ?? [];
  const runs = store.sessionPhaseRuns[sessionId] ?? [];
  for (const run of session.workflowRuns) {
    if (run.discardedAt) {
      continue;
    }
    const template = templates.find((t) => t.id === run.workflowId);
    if (!template) {
      continue;
    }
    const runAgents = runsForWorkflowRun(runs, run.id);
    const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
    for (const step of sortedSteps) {
      const agent = runAgents.find((r) => r.stepId === step.id);
      if (!agent || agent.status !== 'pending') {
        continue;
      }
      const allPrevDone = sortedSteps
        .filter((s) => s.ordinal < step.ordinal)
        .every((s) =>
          runAgents.some(
            (r) => r.stepId === s.id && (r.status === 'completed' || r.status === 'skipped'),
          ),
        );
      if (allPrevDone) {
        await store.activateWorkflowAgent(sessionId, agent.id);
        return;
      }
      break; // earliest pending step blocks the run until its predecessors finish
    }
  }
  throw new Error('no workflow step is ready to advance');
}

// Dispatches a mobile-origin command onto the same store actions the desktop UI
// uses. Long-running turns are fired-and-forgotten: the ACK only confirms the
// command was accepted; turn output reaches the phone through the snapshot.
async function dispatchMobile(cmd: BridgeCommand): Promise<unknown> {
  const store = useAppStore.getState();
  const data = asRecord(cmd.data);

  switch (cmd.kind) {
    case 'queryProviders':
      return buildProviderMenu();

    case 'advanceStep': {
      const sessionId = requireSession(data);
      markSessionMobileShared(sessionId);
      await advanceNextWorkflowStep(sessionId);
      return undefined;
    }

    case 'send': {
      const sessionId = requireSession(data);
      const content = asString(data.content) ?? '';
      const attachments = coerceAttachments(data.attachments);
      if (content.trim().length === 0 && attachments.length === 0) {
        throw new Error('send requires content or attachments');
      }
      markSessionMobileShared(sessionId);
      const agentId = asString(data.agentId) as AgentId | undefined;
      const override = coerceOverride(data);
      void store
        .sendTurn({
          sessionId,
          ...(agentId ? { agentId } : {}),
          content,
          ...(attachments.length > 0 ? { attachments } : {}),
          ...(override ? { override } : {}),
        })
        .catch((e) => console.error('[bridge] mobile send failed', e));
      return undefined;
    }

    case 'spawnAgent': {
      const sessionId = requireSession(data);
      markSessionMobileShared(sessionId);
      const name = asString(data.name);
      const prompt = asString(data.prompt);
      const rawKind = asString(data.kind);
      const kind = rawKind && MOBILE_AGENT_KINDS.has(rawKind) ? (rawKind as AgentKind) : undefined;
      const override = coerceOverride(data);
      await store.spawnAgent(sessionId, {
        ...(name ? { name } : {}),
        ...(prompt ? { initialPrompt: prompt } : {}),
        ...(kind ? { kindOverride: kind } : {}),
        ...(override ? { provider: override.providerId } : {}),
        ...(override?.model ? { model: override.model } : {}),
      });
      return undefined;
    }

    case 'setContextSlot': {
      const sessionId = requireSession(data);
      const rawKey = asString(data.key);
      if (!rawKey || !isSlotKey(rawKey) || !MOBILE_EDITABLE_SLOTS.has(rawKey)) {
        throw new Error(`slot not editable from mobile: ${rawKey ?? '(missing)'}`);
      }
      // Absent value is rejected; an explicit empty string clears the slot.
      const value = typeof data.value === 'string' ? data.value : undefined;
      if (value === undefined) {
        throw new Error('setContextSlot requires a string value');
      }
      markSessionMobileShared(sessionId);
      await store.upsertSessionSlot(sessionId, rawKey, value);
      return undefined;
    }

    case 'resolveComment': {
      const sessionId = requireSession(data);
      const prompt = asString(data.prompt);
      if (!prompt) {
        throw new Error('resolveComment requires a prompt describing the comment');
      }
      markSessionMobileShared(sessionId);
      const sourceCommentUrl = asString(data.commentUrl);
      const sourceThreadId = asString(data.threadId);
      await store.spawnAgent(sessionId, {
        kindOverride: 'resolver',
        deferKickoff: true,
        initialPrompt: prompt,
        ...(sourceCommentUrl ? { sourceCommentUrl } : {}),
        ...(sourceThreadId ? { sourceThreadId } : {}),
      });
      await store.activateNextResolver(sessionId);
      return undefined;
    }

    default:
      throw new Error(`unsupported mobile command: ${cmd.kind}`);
  }
}

export async function executeBridgeCommand(
  cmd: BridgeCommand,
): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  try {
    if (cmd.origin !== 'mobile') {
      // Only mobile-origin commands travel this channel today. A non-mobile
      // origin means a protocol mismatch — refuse rather than guess.
      throw new Error(`unexpected command origin: ${cmd.origin}`);
    }
    const data = await dispatchMobile(cmd);
    return data !== undefined ? { ok: true, data } : { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/// Subscribes the main window to mobile commands forwarded by the Rust bridge,
/// executing each through the security guard and reporting the outcome back so
/// the bridge can ACK the phone. No-op off the main window (the event is
/// broadcast to every window; only one may execute) or outside Tauri.
export const listenBridgeCommands = async (): Promise<UnlistenFn> => {
  if (!inTauri() || !isMainWindow()) {
    return () => undefined;
  }
  return listen<BridgeCommand>(COMMAND_EVENT, (event) => {
    const cmd = event.payload;
    void executeBridgeCommand(cmd)
      .then((result) =>
        invoke('bridge_command_result', {
          id: cmd.id,
          ok: result.ok,
          error: result.error ?? null,
          data: result.data ?? null,
        }),
      )
      .catch((e) => console.error('[bridge] command result dispatch failed', e));
  });
};
