import type {
  PrMergeMethod,
  PullRequestState,
  SessionId,
  Workflow,
  WorkflowId,
  Workspace,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationProvider,
} from '@goodboy/types'

// TODO (@ak): mobile-origin session registry. The permission-mode clamp that
// read this set was removed (desktop + mobile both run bypassPermissions).
// Retained as the origin signal for the pending sandbox-exec confinement of
// mobile-origin spawns; sticky until the desktop revokes via
// clearMobileSharedSessions.
const mobileSharedSessions = new Set<SessionId>()

export const markSessionMobileShared = (sessionId: SessionId): void => {
  mobileSharedSessions.add(sessionId)
}

export const isSessionMobileShared = (sessionId: SessionId): boolean =>
  mobileSharedSessions.has(sessionId)

export const clearMobileSharedSessions = (): void => {
  mobileSharedSessions.clear()
}

// ---------------------------------------------------------------------------
// Mobile merge-PR gate (write path).
//
// SECURITY: merging a PR is irreversible and lands code on the default branch,
// so a mobile-origin merge is the most consequential write the phone can ask
// for. We re-validate the merge precondition SERVER-SIDE against the desktop's
// own PR cache — never the phone's claim. The phone supplies only the merge
// method; the desktop decides whether the PR is mergeable. A phone that lies
// about approval/checks (or replays a stale state) is refused here.
// ---------------------------------------------------------------------------

/** The merge methods the phone may name. The closed set the bridge accepts. */
const MERGE_METHODS: ReadonlySet<string> = new Set<PrMergeMethod>(['squash', 'merge', 'rebase'])

export const isMergeMethod = (v: unknown): v is PrMergeMethod =>
  typeof v === 'string' && MERGE_METHODS.has(v)

export type MergeGate = { readonly ok: true } | { readonly ok: false; readonly reason: string }

/**
 * Decide whether a mobile client may merge `pr` with `method`, using only the
 * trusted server-side PR state. A merge is permitted ONLY when:
 *   - the PR exists and is in an open, non-draft state (open | approved),
 *   - review has been approved (`reviewDecision === 'approved'`),
 *   - CI checks are green (`checks === 'success'`),
 *   - and the method is one of the closed set (squash | merge | rebase).
 * Anything else — null PR, draft, merged/closed, changes requested, pending or
 * failing checks — is refused with a human-readable reason for the phone to show.
 */
export const evaluateMobileMerge = (
  pr: PullRequestState | null | undefined,
  method: string,
): MergeGate => {
  if (!isMergeMethod(method)) {
    return { ok: false, reason: `unsupported merge method: ${String(method)}` }
  }
  if (!pr) {
    return { ok: false, reason: 'no PR is associated with this session' }
  }
  if (pr.isDraft) {
    return { ok: false, reason: 'PR is a draft — mark it ready before merging' }
  }
  if (pr.state === 'merged' || pr.state === 'closed') {
    return { ok: false, reason: `PR is already ${pr.state}` }
  }
  if (pr.state === 'queued') {
    return { ok: false, reason: 'PR is already in the merge queue' }
  }
  if (pr.reviewDecision !== 'approved') {
    return { ok: false, reason: 'PR is not approved' }
  }
  if (pr.checks !== 'success') {
    return {
      ok: false,
      reason: pr.checks === 'failure' ? 'CI checks are failing' : 'CI checks are not green yet',
    }
  }
  if (pr.mergeable === false) {
    return { ok: false, reason: 'PR has conflicts — resolve them first' }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Mobile create-session-from-issue gate (write path).
//
// SECURITY: createSession is a genuinely NEW write class — unlike send/merge it
// has no pre-existing object (session/PR) to authorize against, so the gate is
// built from scratch around the desktop's own trusted state:
//   1. workspaceId must be a real, known workspace (validated against the live
//      store, NEVER the phone's claim) the phone is allowed to target;
//   2. the named provider must actually be CONNECTED for that workspace (the
//      desktop resolves the issue with that workspace's credential — a phone
//      can't point at a workspace where the integration isn't wired up);
//   3. a basic rate/abuse guard — session creation spins up a worktree + agents,
//      so an unbounded mobile loop could exhaust disk/compute. We cap the rate.
// ---------------------------------------------------------------------------

/** Providers a phone may launch a session from. The closed set the bridge accepts. */
const CREATE_SESSION_PROVIDERS: ReadonlySet<string> = new Set<WorkspaceIntegrationProvider>([
  'linear',
  'sentry',
  'gitlab',
])

export const isCreateSessionProvider = (v: unknown): v is WorkspaceIntegrationProvider =>
  typeof v === 'string' && CREATE_SESSION_PROVIDERS.has(v)

export type CreateSessionGate =
  | {
      readonly ok: true
      readonly workspaceId: WorkspaceId
      readonly provider: WorkspaceIntegrationProvider
      // The reserved rate slot. The caller MUST `commit()` once the create lands
      // or `release()` if it fails/aborts. The slot is already counted against
      // the cap, so concurrent commands in the same tick can't bypass the limit.
      readonly reservation: MobileCreateReservation
    }
  | { readonly ok: false; readonly reason: string }

// Rate guard: a sliding window over recent mobile-origin session launches.
// Sticky module state (same rationale as `mobileSharedSessions`) so it can't be
// reset by the phone. Cheap, in-memory; the human revoking the bridge clears it.
//
// SECURITY (TOCTOU): createSession is a long async op (worktree + git + agents),
// and `listenBridgeCommands` fires each command fire-and-forget with no
// serialization. A naive guard that only records a launch AFTER the create
// resolves leaves the window empty for the whole duration of the create, so a
// pipelined burst arriving in the same tick all passes the gate before any of
// them records — the cap collapses to ~unbounded. To close this, the gate
// reserves a slot SYNCHRONOUSLY (no await between check and reserve): we track
// in-flight reservations in `mobileCreatePending` and count them toward the cap
// alongside the completed-launch timestamps. The reservation is later either
// committed (becomes a timestamp) or released (e.g. the create failed), via the
// caller's synchronous commit/release call.
const MOBILE_CREATE_WINDOW_MS = 60_000
const MOBILE_CREATE_MAX_IN_WINDOW = 5
const mobileCreateTimestamps: number[] = []
// In-flight reservations: count of creates that passed the gate but haven't yet
// resolved. Counted toward the cap so concurrent commands can't all slip through
// the same empty window.
let mobileCreatePending = 0

export const clearMobileCreateRateState = (): void => {
  mobileCreateTimestamps.length = 0
  mobileCreatePending = 0
}

/**
 * A reservation handed back by the gate when it passes. The caller MUST call
 * exactly one of `commit` (the create landed) or `release` (the create failed or
 * was abandoned) — `commit` turns the reservation into a counted launch;
 * `release` frees the slot. Both are idempotent and safe to call once.
 */
export type MobileCreateReservation = {
  /** Convert this reservation into a completed launch within the window. */
  readonly commit: (now?: number) => void
  /** Release the reservation without recording a launch (create failed/abandoned). */
  readonly release: () => void
}

const pruneExpired = (now: number): void => {
  const cutoff = now - MOBILE_CREATE_WINDOW_MS
  // Drop expired entries so the window slides and memory stays bounded.
  let head = mobileCreateTimestamps[0]
  while (head !== undefined && head < cutoff) {
    mobileCreateTimestamps.shift()
    head = mobileCreateTimestamps[0]
  }
}

/**
 * Record an accepted launch directly (no reservation). Retained for callers that
 * commit synchronously without holding a reservation across an await.
 *
 * Prefer `reserveMobileSessionSlot` for the create path: it counts the in-flight
 * window so concurrent commands can't bypass the cap.
 */
export const noteMobileSessionCreated = (now: number = Date.now()): void => {
  mobileCreateTimestamps.push(now)
}

const isRateLimited = (now: number): boolean => {
  pruneExpired(now)
  // Count both completed launches AND in-flight reservations against the cap, so
  // a burst of concurrent creates can't all pass before any of them records.
  return mobileCreateTimestamps.length + mobileCreatePending >= MOBILE_CREATE_MAX_IN_WINDOW
}

/**
 * Atomically (relative to the event loop) reserve a rate slot. Returns a
 * reservation when under the cap, or null when rate-limited. Callers MUST invoke
 * this with NO await between the gate decision and this call — the reservation
 * is what makes the check-and-record atomic across concurrent commands.
 */
const reserveSlot = (): MobileCreateReservation | null => {
  mobileCreatePending += 1
  let settled = false
  return {
    commit: (now: number = Date.now()) => {
      if (settled) {
        return
      }
      settled = true
      mobileCreatePending = Math.max(0, mobileCreatePending - 1)
      mobileCreateTimestamps.push(now)
    },
    release: () => {
      if (settled) {
        return
      }
      settled = true
      mobileCreatePending = Math.max(0, mobileCreatePending - 1)
    },
  }
}

/**
 * Decide whether a mobile client may create a session in `workspaceId` from a
 * `provider` issue, using ONLY trusted server-side state:
 *   - `workspaces`: the live workspace list (the phone's claimed id must match a
 *     real, non-deleted workspace),
 *   - `integrations`: that workspace's connected integrations (the provider must
 *     be present — i.e. actually connected for this workspace).
 * The phone supplies the ids; the desktop decides if they're legitimate. Forged
 * or disallowed workspace ids, and disconnected providers, are refused here with
 * a human-readable reason. Also enforces the create rate limit.
 */
export const evaluateMobileCreateSession = (args: {
  readonly workspaceId: unknown
  readonly provider: unknown
  readonly workspaces: ReadonlyArray<Pick<Workspace, 'id'>>
  readonly integrations: ReadonlyArray<Pick<WorkspaceIntegration, 'provider'>>
  readonly now?: number
}): CreateSessionGate => {
  const { workspaceId, provider, workspaces, integrations } = args
  const now = args.now ?? Date.now()

  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    return { ok: false, reason: 'missing workspaceId' }
  }
  if (!isCreateSessionProvider(provider)) {
    return { ok: false, reason: `unsupported provider: ${String(provider)}` }
  }
  // (1) Validate the workspace against the desktop's OWN list — never the claim.
  const known = workspaces.some((w) => w.id === workspaceId)
  if (!known) {
    return { ok: false, reason: `unknown workspace: ${workspaceId}` }
  }
  // (2) The provider must be connected FOR THIS WORKSPACE (caller passes only
  // that workspace's integration rows). A phone can't launch from an integration
  // that isn't wired up — the desktop has no credential to resolve the issue.
  const connected = integrations.some((i) => i.provider === provider)
  if (!connected) {
    return { ok: false, reason: `${provider} is not connected for this workspace` }
  }
  // (3) Abuse guard. Check AND reserve atomically — no await between the
  // isRateLimited() read and reserveSlot() — so a pipelined burst of creates
  // arriving in the same tick can't all pass the (empty) window. The reservation
  // is counted against the cap immediately; the caller commits/releases it.
  if (isRateLimited(now)) {
    return { ok: false, reason: 'too many session launches — slow down and retry shortly' }
  }
  const reservation = reserveSlot()
  if (!reservation) {
    return { ok: false, reason: 'too many session launches — slow down and retry shortly' }
  }
  return { ok: true, workspaceId: workspaceId as WorkspaceId, provider, reservation }
}

// ---------------------------------------------------------------------------
// Mobile spawn-workflow gate (write path).
//
// SECURITY: attaching a workflow to a session queues real agents/turns, so the
// phone must not be able to point a session at an arbitrary (or another
// workspace's) workflow. We re-validate SERVER-SIDE against the desktop's OWN
// state — never the phone's claim:
//   1. the named session must be a real, known session (its workspace is the
//      trusted scope — taken from the session, not the phone);
//   2. the named workflow must exist among that workspace's templates (the phone
//      can't attach a workflow that doesn't belong to the session's workspace).
// The attach itself is done WITHOUT auto-running (autoRun:false / manual trigger)
// so the first step is left pending for the human to Start via advanceStep.
// ---------------------------------------------------------------------------

export type SpawnWorkflowGate =
  | {
      readonly ok: true
      readonly sessionId: SessionId
      readonly workflowId: WorkflowId
    }
  | { readonly ok: false; readonly reason: string }

/**
 * Decide whether a mobile client may attach `workflowId` to `sessionId`, using
 * ONLY trusted server-side state:
 *   - `sessions`: the live session list (the phone's claimed id must match a
 *     real session; that session's `workspaceId` is the trusted scope),
 *   - `workflowsForWorkspace`: the workflow templates for the SESSION'S
 *     workspace (the workflow must be one of these — a phone can't attach a
 *     workflow from a workspace the session doesn't belong to).
 * The phone supplies the ids; the desktop decides if they're legitimate. Forged
 * session ids and cross-workspace workflow ids are refused here with a
 * human-readable reason.
 */
export const evaluateMobileSpawnWorkflow = (args: {
  readonly sessionId: unknown
  readonly workflowId: unknown
  readonly sessions: ReadonlyArray<{ readonly id: SessionId; readonly workspaceId: WorkspaceId }>
  readonly workflowsForWorkspace: ReadonlyArray<Pick<Workflow, 'id'>>
}): SpawnWorkflowGate => {
  const { sessionId, workflowId, sessions, workflowsForWorkspace } = args

  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return { ok: false, reason: 'missing sessionId' }
  }
  if (typeof workflowId !== 'string' || workflowId.length === 0) {
    return { ok: false, reason: 'missing workflowId' }
  }
  // (1) Validate the session against the desktop's OWN list — never the claim.
  const session = sessions.find((s) => s.id === sessionId)
  if (!session) {
    return { ok: false, reason: `unknown session: ${sessionId}` }
  }
  // (2) The workflow must belong to the SESSION'S workspace (caller passes only
  // that workspace's templates). A phone can't attach a foreign workflow.
  const known = workflowsForWorkspace.some((w) => w.id === workflowId)
  if (!known) {
    return { ok: false, reason: `unknown workflow for this session: ${workflowId}` }
  }
  return { ok: true, sessionId: sessionId as SessionId, workflowId: workflowId as WorkflowId }
}
