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
import { worktreeDiffFile } from '../worktree/worktree';
import {
  evaluateMobileCreateSession,
  evaluateMobileMerge,
  evaluateMobileSpawnWorkflow,
  isMergeMethod,
  markSessionMobileShared,
} from './mobileConfinement';
import type { AgentKind } from '../session/agent-kind';
import type {
  SessionExternalTaskProvider,
  WorkspaceId,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';
import { linearFetchAssignedIssues, type LinearIssue } from '../integrations/linear/client';
import { goalFromIssue as linearGoalFromIssue } from '../integrations/linear/goal-from-issue';
import {
  sentryFetchIssues,
  sentryFetchIssueDetail,
  type SentryIssue,
} from '../integrations/sentry/client';
import { goalFromSentry } from '../integrations/sentry/goal-from-sentry';
import {
  gitlabFetchAssignedIssues,
  issueIdentifier as gitlabIssueIdentifier,
  type GitlabIssue,
} from '../integrations/gitlab/client';
import { goalFromIssue as gitlabGoalFromIssue } from '../integrations/gitlab/goal-from-issue';

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

// Errors whose message is SAFE to forward to the phone verbatim: our own
// friendly validation/precondition messages (unknown workspace, disconnected
// provider, rate limited, issue-not-found, host-not-configured, merge refused).
// Anything NOT a BridgeSafeError is treated as a raw provider/client failure and
// masked before crossing the bridge — raw remote HTTP bodies can carry tokens,
// PII, or internal detail and must never reach the phone.
class BridgeSafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BridgeSafeError';
  }
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
    throw new BridgeSafeError('missing sessionId');
  }
  const known = useAppStore.getState().sessions.some((s) => s.id === id);
  if (!known) {
    throw new BridgeSafeError(`unknown session: ${id}`);
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

// ---------------------------------------------------------------------------
// External issue inbox (read) + launch-from-issue (write).
//
// SECURITY: issues are fetched live by the DESKTOP using the workspace's own
// stored credential (the Rust `*_fetch_*` commands read the credential server-
// side). The phone only ever receives the NORMALIZED issue fields below — never
// a token, credential key, or raw provider payload. createSessionFromIssue also
// re-resolves the issue desktop-side; the phone supplies only an identifier.
// ---------------------------------------------------------------------------

// The phone-facing issue shape. Deliberately minimal: no tokens/secrets, no raw
// provider objects — only what the mobile inbox renders. Mirrors `ExternalIssue`
// (Protocol/Models.swift).
type NormalizedIssue = {
  readonly provider: WorkspaceIntegrationProvider;
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
  readonly state: string | null;
  readonly description: string | null;
};

const ALL_ISSUE_PROVIDERS: ReadonlyArray<WorkspaceIntegrationProvider> = [
  'linear',
  'sentry',
  'gitlab',
];

const normalizeLinear = (i: LinearIssue): NormalizedIssue => ({
  provider: 'linear',
  identifier: i.identifier,
  title: i.title,
  url: i.url,
  state: i.state?.name ?? null,
  description: i.description ?? null,
});

const normalizeSentry = (i: SentryIssue): NormalizedIssue => ({
  provider: 'sentry',
  identifier: i.shortId ?? i.id,
  title: i.title,
  url: i.permalink ?? '',
  state: i.status ?? null,
  description: i.culprit ?? null,
});

const normalizeGitlab = (i: GitlabIssue): NormalizedIssue => ({
  provider: 'gitlab',
  identifier: gitlabIssueIdentifier(i),
  title: i.title,
  url: i.webUrl,
  state: i.state ?? null,
  description: i.description ?? null,
});

// Find the host for a workspace's gitlab integration (the fetch needs it). Read
// from the trusted store config, never the phone.
function gitlabHostFor(workspaceId: WorkspaceId): string | undefined {
  const rows = useAppStore.getState().workspaceIntegrations[workspaceId] ?? [];
  const row = rows.find((r) => r.provider === 'gitlab');
  return row && row.provider === 'gitlab' ? row.config.host : undefined;
}

// Which providers are connected for a workspace, per the trusted store.
function connectedProviders(workspaceId: WorkspaceId): ReadonlySet<WorkspaceIntegrationProvider> {
  const rows = useAppStore.getState().workspaceIntegrations[workspaceId] ?? [];
  return new Set(rows.map((r) => r.provider));
}

// Fetch + normalize issues for one workspace+provider. Errors per integration are
// swallowed (logged) so one mis-configured provider doesn't blank the whole inbox.
async function fetchIssuesFor(
  workspaceId: WorkspaceId,
  provider: WorkspaceIntegrationProvider,
): Promise<NormalizedIssue[]> {
  try {
    if (provider === 'linear') {
      return (await linearFetchAssignedIssues(workspaceId)).map(normalizeLinear);
    }
    if (provider === 'sentry') {
      const page = await sentryFetchIssues(workspaceId);
      return page.issues.map(normalizeSentry);
    }
    const host = gitlabHostFor(workspaceId);
    if (!host) {
      return [];
    }
    return (await gitlabFetchAssignedIssues(workspaceId, host)).map(normalizeGitlab);
  } catch (e) {
    console.error(`[bridge] queryIssues ${provider} fetch failed`, e);
    return [];
  }
}

// queryIssues: gather connected-integration issues across every workspace the
// phone can see (the snapshot already mirrors all non-deleted workspaces). An
// optional provider filter narrows the set. Returns only normalized issues — no
// tokens ever leave the desktop.
async function queryIssuesForMobile(filter?: WorkspaceIntegrationProvider): Promise<{
  issues: ReadonlyArray<NormalizedIssue>;
}> {
  const store = useAppStore.getState();
  const wanted = filter ? [filter] : ALL_ISSUE_PROVIDERS;
  const jobs: Array<Promise<NormalizedIssue[]>> = [];
  for (const ws of store.workspaces) {
    const connected = connectedProviders(ws.id);
    for (const provider of wanted) {
      if (connected.has(provider)) {
        jobs.push(fetchIssuesFor(ws.id, provider));
      }
    }
  }
  const settled = await Promise.all(jobs);
  return { issues: settled.flat() };
}

// Re-resolve one issue desktop-side by identifier, deriving the session goal with
// the provider's own `goalFromIssue`. The phone names the issue; the desktop
// fetches it with its stored credential and computes the goal — provider tokens
// never reach the phone, and the phone can't smuggle a forged goal/url/title.
async function resolveIssueForSession(
  workspaceId: WorkspaceId,
  provider: WorkspaceIntegrationProvider,
  identifier: string,
): Promise<{
  goal: string;
  externalTask: {
    provider: SessionExternalTaskProvider;
    externalId: string;
    identifier: string;
    url: string;
    title: string;
  };
}> {
  if (provider === 'linear') {
    const issue = (await linearFetchAssignedIssues(workspaceId)).find(
      (i) => i.identifier === identifier,
    );
    if (!issue) {
      throw new BridgeSafeError(`linear issue not found: ${identifier}`);
    }
    return {
      goal: linearGoalFromIssue(issue),
      externalTask: {
        provider: 'linear',
        externalId: issue.id,
        identifier: issue.identifier,
        url: issue.url,
        title: issue.title,
      },
    };
  }
  if (provider === 'sentry') {
    const page = await sentryFetchIssues(workspaceId);
    const issue = page.issues.find((i) => (i.shortId ?? i.id) === identifier);
    if (!issue) {
      throw new BridgeSafeError(`sentry issue not found: ${identifier}`);
    }
    const detail = await sentryFetchIssueDetail(workspaceId, issue.id).catch(() => null);
    return {
      goal: goalFromSentry(issue, detail),
      externalTask: {
        provider: 'sentry',
        externalId: issue.id,
        identifier: issue.shortId ?? issue.id,
        url: issue.permalink ?? '',
        title: issue.title,
      },
    };
  }
  const host = gitlabHostFor(workspaceId);
  if (!host) {
    throw new BridgeSafeError('gitlab host not configured for this workspace');
  }
  const issue = (await gitlabFetchAssignedIssues(workspaceId, host)).find(
    (i) => gitlabIssueIdentifier(i) === identifier,
  );
  if (!issue) {
    throw new BridgeSafeError(`gitlab issue not found: ${identifier}`);
  }
  return {
    goal: gitlabGoalFromIssue(issue),
    externalTask: {
      provider: 'gitlab',
      externalId: String(issue.id),
      identifier: gitlabIssueIdentifier(issue),
      url: issue.webUrl,
      title: issue.title,
    },
  };
}

// Resolve an issue for a mobile-launched session, MASKING any raw provider/
// client failure before it can cross the bridge. Our own friendly validation
// throws (issue-not-found, host-not-configured — BridgeSafeError) pass through
// unchanged; anything else (a remote HTTP error whose body may carry tokens/PII/
// internal detail, a network failure, a parser blowup) is logged desktop-side
// with the real error and re-thrown as a generic, phone-safe BridgeSafeError.
async function resolveIssueForSessionSafe(
  workspaceId: WorkspaceId,
  provider: WorkspaceIntegrationProvider,
  identifier: string,
): Promise<Awaited<ReturnType<typeof resolveIssueForSession>>> {
  try {
    return await resolveIssueForSession(workspaceId, provider, identifier);
  } catch (e) {
    if (e instanceof BridgeSafeError) {
      throw e;
    }
    console.error(
      `[bridge] resolveIssueForSession failed (provider=${provider}, identifier=${identifier})`,
      e,
    );
    throw new BridgeSafeError(`could not resolve issue ${identifier}`);
  }
}

// advanceStep: activate the next pending workflow agent whose predecessors are
// all done. Mirrors `maybeAutoAdvanceWorkflow`'s eligibility check, but here the
// human on the phone is explicitly advancing, so the autoRun gate doesn't apply.
async function advanceNextWorkflowStep(sessionId: SessionId): Promise<void> {
  const store = useAppStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session || session.workflowRuns.length === 0) {
    throw new BridgeSafeError('session has no workflow to advance');
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
  throw new BridgeSafeError('no workflow step is ready to advance');
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

    case 'queryIssues': {
      // Read-only: optional provider filter, normalized issues, no tokens.
      const rawProvider = asString(data.provider);
      const filter =
        rawProvider && ALL_ISSUE_PROVIDERS.includes(rawProvider as WorkspaceIntegrationProvider)
          ? (rawProvider as WorkspaceIntegrationProvider)
          : undefined;
      return queryIssuesForMobile(filter);
    }

    case 'queryFileDiff': {
      // Read-only: the unified git diff TEXT for ONE file in the session's own
      // worktree. The phone names sessionId + path; the desktop validates the
      // session against its OWN list and resolves the worktree path itself (the
      // phone never supplies a path/cwd outside the file name). Path traversal is
      // refused SERVER-SIDE in `worktree_diff_file` (confine_rel_path), which
      // anchors the pathspec at the worktree root — a `..` or absolute path that
      // escapes the worktree is rejected. Same merge-base/ref as the desktop's
      // own file-changes view (worktree_diff), so the diff matches the numstat.
      const sessionId = requireSession(data);
      const path = asString(data.path);
      if (!path) {
        throw new BridgeSafeError('queryFileDiff requires a path');
      }
      const worktreePath = (store.sessionWorktrees[sessionId] ?? [])[0] ?? null;
      if (!worktreePath) {
        throw new BridgeSafeError('session worktree is not available');
      }
      const diff = await worktreeDiffFile(worktreePath, path);
      return { diff };
    }

    case 'createSessionFromIssue': {
      // SECURITY-GATED write. The phone names workspaceId + provider + issue
      // identifier; the desktop re-validates the workspace and provider against
      // its OWN state, resolves the issue + goal server-side (tokens never leave
      // the desktop), then creates the session through the same store action the
      // desktop UI uses. The new session is marked mobile-shared so every kickoff
      // turn is clamped via sendTurn's existing choke point.
      const workspaceId = asString(data.workspaceId);
      const provider = asString(data.provider);
      const identifier = asString(data.issueIdentifier);
      const setupWorkflow = data.setupWorkflow === true;
      if (!identifier) {
        throw new BridgeSafeError('createSessionFromIssue requires an issueIdentifier');
      }
      const gate = evaluateMobileCreateSession({
        workspaceId,
        provider,
        workspaces: store.workspaces,
        integrations: workspaceId
          ? (store.workspaceIntegrations[workspaceId as WorkspaceId] ?? [])
          : [],
      });
      if (!gate.ok) {
        throw new BridgeSafeError(`create session refused: ${gate.reason}`);
      }
      // The gate already reserved a rate slot (counted against the cap up front
      // so a concurrent burst can't bypass it). Commit it once the session lands;
      // release it if resolve/create throws, so a failed attempt doesn't burn the
      // window. No await sits between the gate decision and the reservation.
      let session;
      try {
        const resolved = await resolveIssueForSessionSafe(
          gate.workspaceId,
          gate.provider,
          identifier,
        );
        // Pass mobileShared so createSession registers the confinement
        // SYNCHRONOUSLY (before its own kickoff turn / workflow prespawn can
        // dispatch). Marking here, after createSession resolved, would race a
        // kickoff turn fired during creation — the ordering fix lives in
        // createSession itself now.
        ({ session } = await store.createSession({
          workspaceId: gate.workspaceId,
          goal: resolved.goal,
          externalTask: resolved.externalTask,
          mobileShared: true,
        }));
      } catch (e) {
        gate.reservation.release();
        throw e;
      }
      gate.reservation.commit();
      // Idempotent reassert (createSession already marked it before any kickoff).
      markSessionMobileShared(session.id);
      if (setupWorkflow) {
        // Mirror NewSessionView: surface the workflow builder on the desktop.
        // Harmless when no window is listening (e.g. headless bridge).
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('goodboy:open-workflow-builder', {
                detail: { sessionId: session.id },
              }),
            );
          }
        } catch {
          // best-effort UI hint; never fail the create over it
        }
      }
      return { sessionId: session.id };
    }

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
        throw new BridgeSafeError('send requires content or attachments');
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
        throw new BridgeSafeError(`slot not editable from mobile: ${rawKey ?? '(missing)'}`);
      }
      // Absent value is rejected; an explicit empty string clears the slot.
      const value = typeof data.value === 'string' ? data.value : undefined;
      if (value === undefined) {
        throw new BridgeSafeError('setContextSlot requires a string value');
      }
      markSessionMobileShared(sessionId);
      await store.upsertSessionSlot(sessionId, rawKey, value);
      return undefined;
    }

    case 'resolveComment': {
      const sessionId = requireSession(data);
      const prompt = asString(data.prompt);
      if (!prompt) {
        throw new BridgeSafeError('resolveComment requires a prompt describing the comment');
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

    case 'mergePr': {
      const sessionId = requireSession(data);
      // Re-validate the merge precondition against the desktop's OWN PR state,
      // never the phone's claim: the phone supplies only the method. A PR that
      // isn't approved + green (or is draft/merged/closed) is refused here, so a
      // lying or stale client can't land code on the default branch.
      const method = asString(data.method) ?? 'squash';
      const pr = store.sessionGithub[sessionId]?.pr ?? null;
      const gate = evaluateMobileMerge(pr, method);
      if (!gate.ok) {
        throw new BridgeSafeError(`merge refused: ${gate.reason}`);
      }
      // gate.ok guarantees the method is valid; this narrows it for the store.
      if (!isMergeMethod(method)) {
        throw new BridgeSafeError(`unsupported merge method: ${method}`);
      }
      markSessionMobileShared(sessionId);
      // Reuse the exact desktop merge path (gh pr merge --{method}); pass the
      // server-known PR number so the phone can't redirect the merge elsewhere.
      await store.mergePr(sessionId, pr?.number, method);
      return undefined;
    }

    case 'spawnWorkflow': {
      // SECURITY-GATED write. The phone names sessionId + workflowId; the desktop
      // re-validates the session against its OWN list and that the workflow
      // belongs to THAT session's workspace (never the phone's claim), then
      // ATTACHES the workflow without auto-running — autoRun:false + manual
      // trigger leave the first step pending for the human to Start via
      // advanceStep (0x83), exactly like a desktop manual-trigger attach.
      const workflowId = asString(data.workflowId);
      const session = store.sessions.find((s) => s.id === asString(data.sessionId));
      const gate = evaluateMobileSpawnWorkflow({
        sessionId: data.sessionId,
        workflowId,
        sessions: store.sessions,
        workflowsForWorkspace: session ? (store.phaseTemplates[session.workspaceId] ?? []) : [],
      });
      if (!gate.ok) {
        throw new BridgeSafeError(`spawn workflow refused: ${gate.reason}`);
      }
      markSessionMobileShared(gate.sessionId);
      await store.attachWorkflowToSession(gate.sessionId, gate.workflowId, {
        autoRun: false,
        triggerMode: 'manual',
      });
      return undefined;
    }

    default:
      throw new BridgeSafeError(`unsupported mobile command: ${cmd.kind}`);
  }
}

// Per-kind generic phone-facing mask used when an UNSAFE error escapes a command
// (anything that is not a BridgeSafeError — a raw `gh pr merge` stderr, an
// internal store Error.message, a network/parser blowup). The real error is
// logged desktop-side; the phone only ever sees one of these fixed strings, so
// no token / remote body / internal path can ride out on an ACK.
function genericMaskFor(kind: string): string {
  switch (kind) {
    case 'mergePr':
      return 'merge failed';
    case 'spawnAgent':
    case 'resolveComment':
      return 'could not spawn agent';
    case 'setContextSlot':
      return 'could not update context';
    case 'advanceStep':
      return 'could not advance workflow';
    case 'spawnWorkflow':
      return 'could not attach workflow';
    case 'send':
      return 'send failed';
    case 'createSessionFromIssue':
      return 'could not create session';
    case 'queryFileDiff':
      return 'could not load file diff';
    default:
      return 'command failed';
  }
}

export async function executeBridgeCommand(
  cmd: BridgeCommand,
): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  try {
    if (cmd.origin !== 'mobile') {
      // Only mobile-origin commands travel this channel today. A non-mobile
      // origin means a protocol mismatch — refuse rather than guess.
      throw new BridgeSafeError(`unexpected command origin: ${cmd.origin}`);
    }
    const data = await dispatchMobile(cmd);
    return data !== undefined ? { ok: true, data } : { ok: true };
  } catch (err) {
    // SINGLE sanitization boundary for the whole bridge. Our own friendly
    // validation/precondition messages are thrown as BridgeSafeError and forwarded
    // verbatim (unknown session, merge refused, issue not found, …). EVERYTHING
    // else — a raw `gh pr merge` stderr re-thrown by store.mergePr, an internal
    // Error.message from any await'd store action (spawnAgent, resolveComment,
    // setContextSlot, advanceStep), a network/parser failure — is logged
    // desktop-side and replaced with a fixed per-kind generic before it can cross
    // the bridge. This closes mergePr + all await'd store actions at one gate.
    if (err instanceof BridgeSafeError) {
      return { ok: false, error: err.message };
    }
    const data = asRecord(cmd.data);
    console.error(
      `[bridge] command failed (kind=${cmd.kind}, sessionId=${asString(data.sessionId) ?? '(none)'})`,
      err,
    );
    return { ok: false, error: genericMaskFor(cmd.kind) };
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
