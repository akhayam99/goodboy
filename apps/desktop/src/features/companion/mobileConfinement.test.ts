import { afterEach, describe, expect, it } from 'vitest'
import type { PullRequestState, SessionId, WorkflowId, WorkspaceId } from '@goodboy/types'
import {
  clearMobileCreateRateState,
  clearMobileSharedSessions,
  evaluateMobileCreateSession,
  evaluateMobileMerge,
  evaluateMobileSpawnWorkflow,
  isMergeMethod,
  isSessionMobileShared,
  markSessionMobileShared,
} from './mobileConfinement'

const sid = (s: string): SessionId => s as SessionId

// A fully-eligible PR (approved + green + open + non-draft + mergeable). Tests
// override one field at a time to assert each gate independently.
const eligiblePr = (over: Partial<PullRequestState> = {}): PullRequestState => ({
  number: 7,
  title: 'feat: thing',
  url: 'https://github.com/x/y/pull/7',
  state: 'approved',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'feat/thing',
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: '2026-06-22T00:00:00Z',
  ...over,
})

afterEach(() => clearMobileSharedSessions())

describe('mobile shared-session registry', () => {
  it('starts empty and marks a session shared', () => {
    expect(isSessionMobileShared(sid('s1'))).toBe(false)
    markSessionMobileShared(sid('s1'))
    expect(isSessionMobileShared(sid('s1'))).toBe(true)
  })

  it('is sticky and idempotent until explicitly cleared (desktop revoke)', () => {
    markSessionMobileShared(sid('s1'))
    markSessionMobileShared(sid('s1'))
    expect(isSessionMobileShared(sid('s1'))).toBe(true)
    clearMobileSharedSessions()
    expect(isSessionMobileShared(sid('s1'))).toBe(false)
  })

  it('confines each session independently', () => {
    markSessionMobileShared(sid('s1'))
    expect(isSessionMobileShared(sid('s1'))).toBe(true)
    expect(isSessionMobileShared(sid('s2'))).toBe(false)
  })
})

describe('isMergeMethod', () => {
  it('accepts only the closed squash|merge|rebase set', () => {
    for (const m of ['squash', 'merge', 'rebase']) {
      expect(isMergeMethod(m)).toBe(true)
    }
    for (const m of ['', 'SQUASH', 'fast-forward', 'delete', 42, null, undefined, {}]) {
      expect(isMergeMethod(m)).toBe(false)
    }
  })
})

describe('evaluateMobileMerge (server-side gate)', () => {
  it('permits a merge only when approved + green + open + mergeable', () => {
    expect(evaluateMobileMerge(eligiblePr(), 'squash')).toEqual({ ok: true })
    expect(evaluateMobileMerge(eligiblePr({ state: 'open' }), 'merge')).toEqual({ ok: true })
    expect(evaluateMobileMerge(eligiblePr(), 'rebase')).toEqual({ ok: true })
  })

  it('refuses an unsupported method even when the PR is eligible', () => {
    const gate = evaluateMobileMerge(eligiblePr(), 'fast-forward')
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/method/i)
  })

  it('refuses when there is no PR for the session', () => {
    expect(evaluateMobileMerge(null, 'squash').ok).toBe(false)
    expect(evaluateMobileMerge(undefined, 'squash').ok).toBe(false)
  })

  it('refuses a draft PR', () => {
    const gate = evaluateMobileMerge(eligiblePr({ isDraft: true }), 'squash')
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/draft/i)
  })

  it('refuses an already-merged or closed PR', () => {
    expect(evaluateMobileMerge(eligiblePr({ state: 'merged' }), 'squash').ok).toBe(false)
    expect(evaluateMobileMerge(eligiblePr({ state: 'closed' }), 'squash').ok).toBe(false)
  })

  it('refuses a PR already in the merge queue', () => {
    const gate = evaluateMobileMerge(eligiblePr({ state: 'queued' }), 'squash')
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/queue/i)
  })

  it('refuses when review is not approved (never trusts a stale/lying client)', () => {
    for (const decision of ['changes_requested', 'review_required', null] as const) {
      const gate = evaluateMobileMerge(eligiblePr({ reviewDecision: decision }), 'squash')
      expect(gate.ok).toBe(false)
      if (!gate.ok) expect(gate.reason).toMatch(/approv/i)
    }
  })

  it('refuses when CI checks are not green', () => {
    const failing = evaluateMobileMerge(eligiblePr({ checks: 'failure' }), 'squash')
    expect(failing.ok).toBe(false)
    if (!failing.ok) expect(failing.reason).toMatch(/fail/i)

    const pending = evaluateMobileMerge(eligiblePr({ checks: 'pending' }), 'squash')
    expect(pending.ok).toBe(false)

    const missing = evaluateMobileMerge(eligiblePr({ checks: null }), 'squash')
    expect(missing.ok).toBe(false)
  })

  it('refuses a known-unmergeable PR (conflicts) even when approved + green', () => {
    const gate = evaluateMobileMerge(eligiblePr({ mergeable: false }), 'squash')
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/conflict/i)
  })
})

describe('evaluateMobileCreateSession', () => {
  // Trusted server-side state the gate validates against. The phone's claims
  // (workspaceId/provider) are tested against THESE, never trusted directly.
  const workspaces = [{ id: 'w1' as WorkspaceId }, { id: 'w2' as WorkspaceId }]
  const linearOnW1 = [{ provider: 'linear' as const }]

  afterEach(() => clearMobileCreateRateState())

  it('accepts a known workspace with the provider connected', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      workspaces,
      integrations: linearOnW1,
    })
    expect(gate.ok).toBe(true)
    if (gate.ok) {
      expect(gate.workspaceId).toBe('w1')
      expect(gate.provider).toBe('linear')
    }
  })

  it('refuses a missing workspaceId', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: undefined,
      provider: 'linear',
      workspaces,
      integrations: linearOnW1,
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/workspaceId/i)
  })

  it('refuses an unsupported provider', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'github',
      workspaces,
      integrations: linearOnW1,
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/provider/i)
  })

  // ADVERSARIAL: a lying phone claims a workspaceId the desktop does not have.
  it('refuses a forged/disallowed workspaceId (not in the trusted list)', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w-evil',
      provider: 'linear',
      workspaces, // only w1, w2 are real
      integrations: linearOnW1,
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/unknown workspace/i)
  })

  // ADVERSARIAL: target a real workspace but a provider that isn't connected
  // there — the desktop has no credential to resolve the issue, so refuse.
  it('refuses a provider that is not connected for the target workspace', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'sentry', // only linear is connected on w1
      workspaces,
      integrations: linearOnW1,
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/not connected/i)
  })

  // ADVERSARIAL: w2 exists but has no integrations at all — can't launch from it.
  it('refuses a workspace with no integrations connected', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w2',
      provider: 'linear',
      workspaces,
      integrations: [], // w2 has nothing wired up
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/not connected/i)
  })

  it('rate-limits a burst of launches (abuse guard)', () => {
    const ok = () => {
      const g = evaluateMobileCreateSession({
        workspaceId: 'w1',
        provider: 'linear',
        workspaces,
        integrations: linearOnW1,
        now: 1_000,
      })
      // The gate reserves the slot up front; committing turns it into a counted
      // launch (matches the executor's commit-on-success path).
      if (g.ok) g.reservation.commit(1_000)
      return g.ok
    }
    // First five within the window pass; the sixth is throttled.
    for (let i = 0; i < 5; i += 1) {
      expect(ok()).toBe(true)
    }
    const sixth = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      workspaces,
      integrations: linearOnW1,
      now: 1_000,
    })
    expect(sixth.ok).toBe(false)
    if (!sixth.ok) expect(sixth.reason).toMatch(/too many|slow down/i)

    // After the window slides, launches are allowed again.
    const later = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      workspaces,
      integrations: linearOnW1,
      now: 1_000 + 61_000,
    })
    expect(later.ok).toBe(true)
  })

  // SECURITY (TOCTOU): a pipelined burst arriving in the same tick must NOT all
  // pass the gate. The reservation is counted against the cap synchronously, so
  // even with NO create having resolved yet, the 6th concurrent gate is refused.
  it('counts in-flight reservations against the cap (no concurrent bypass)', () => {
    const gate = () =>
      evaluateMobileCreateSession({
        workspaceId: 'w1',
        provider: 'linear',
        workspaces,
        integrations: linearOnW1,
        now: 2_000,
      })
    // Five concurrent gates pass and HOLD their reservations (no commit yet —
    // simulating five long createSession ops still in flight).
    const held = []
    for (let i = 0; i < 5; i += 1) {
      const g = gate()
      expect(g.ok).toBe(true)
      if (g.ok) held.push(g.reservation)
    }
    // Sixth concurrent gate is refused purely on pending reservations, even
    // though zero creates have completed (mobileCreateTimestamps is empty).
    const sixth = gate()
    expect(sixth.ok).toBe(false)
    if (!sixth.ok) expect(sixth.reason).toMatch(/too many|slow down/i)

    // Releasing one reservation (a failed create) frees a slot for a retry.
    held[0]!.release()
    const retry = gate()
    expect(retry.ok).toBe(true)
  })

  // A released reservation must not consume a slot OR throw on double-settle.
  it('releases a reserved slot without recording a launch; settle is idempotent', () => {
    const g = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      workspaces,
      integrations: linearOnW1,
      now: 3_000,
    })
    expect(g.ok).toBe(true)
    if (!g.ok) return
    g.reservation.release()
    // Double-settle is a no-op (commit after release does nothing).
    g.reservation.commit(3_000)
    // Slot was freed: a full burst of five fresh launches still fits.
    for (let i = 0; i < 5; i += 1) {
      const next = evaluateMobileCreateSession({
        workspaceId: 'w1',
        provider: 'linear',
        workspaces,
        integrations: linearOnW1,
        now: 3_000,
      })
      expect(next.ok).toBe(true)
      if (next.ok) next.reservation.commit(3_000)
    }
  })
})

describe('evaluateMobileSpawnWorkflow (server-side gate)', () => {
  const sessions = [
    { id: sid('s1'), workspaceId: 'w1' as WorkspaceId },
    { id: sid('s2'), workspaceId: 'w2' as WorkspaceId },
  ]
  const w1Workflows = [{ id: 'wf-a' as WorkflowId }, { id: 'wf-b' as WorkflowId }]

  it('passes for a known session + a workflow in that session workspace', () => {
    const gate = evaluateMobileSpawnWorkflow({
      sessionId: 's1',
      workflowId: 'wf-a',
      sessions,
      workflowsForWorkspace: w1Workflows,
    })
    expect(gate.ok).toBe(true)
    if (gate.ok) {
      expect(gate.sessionId).toBe('s1')
      expect(gate.workflowId).toBe('wf-a')
    }
  })

  it('refuses a missing sessionId', () => {
    const gate = evaluateMobileSpawnWorkflow({
      sessionId: '',
      workflowId: 'wf-a',
      sessions,
      workflowsForWorkspace: w1Workflows,
    })
    expect(gate).toMatchObject({ ok: false })
  })

  it('refuses a missing workflowId', () => {
    const gate = evaluateMobileSpawnWorkflow({
      sessionId: 's1',
      workflowId: undefined,
      sessions,
      workflowsForWorkspace: w1Workflows,
    })
    expect(gate).toMatchObject({ ok: false })
  })

  it('refuses an unknown (forged) session id', () => {
    const gate = evaluateMobileSpawnWorkflow({
      sessionId: 'nope',
      workflowId: 'wf-a',
      sessions,
      workflowsForWorkspace: w1Workflows,
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/unknown session/)
  })

  it('refuses a workflow that is not in the session workspace', () => {
    // caller passes only the session's own workspace templates; a cross-workspace
    // workflow id is therefore absent and refused.
    const gate = evaluateMobileSpawnWorkflow({
      sessionId: 's1',
      workflowId: 'wf-from-w2',
      sessions,
      workflowsForWorkspace: w1Workflows,
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/unknown workflow/)
  })
})
