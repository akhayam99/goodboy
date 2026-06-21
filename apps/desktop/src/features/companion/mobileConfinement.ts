import type { ClaudePermissionMode, SessionId } from '@goodboy/types';

// Sessions a paired phone is currently driving. Every turn a mobile command
// triggers — kickoffs, fan-out children, scout/resolver chains — funnels
// through `sendTurn`, which consults this set and clamps the permission mode.
// Tracking it here (module scope, not React state) makes the choke point
// impossible to bypass: any present or future internal `sendTurn` caller is
// covered without having to thread a flag through every path.
//
// Sticky by design: a session stays confined until the desktop revokes mobile
// access (bridge stop / device revoke). The human, not the phone, decides when
// full power returns — so a mobile client can never quietly lift the ceiling.
const mobileSharedSessions = new Set<SessionId>();

export const markSessionMobileShared = (sessionId: SessionId): void => {
  mobileSharedSessions.add(sessionId);
};

export const isSessionMobileShared = (sessionId: SessionId): boolean =>
  mobileSharedSessions.has(sessionId);

export const clearMobileSharedSessions = (): void => {
  mobileSharedSessions.clear();
};

// A mobile-driven turn may never run more permissively than `default`: every
// edit/Bash that isn't covered by a desktop-set allow-rule then requires
// explicit desktop approval, so the phone cannot auto-approve writes that
// escape the worktree. `plan` (read-only) is preserved when already in effect.
//
// TODO (@ak): the clamp gates tool *approval*, not the process. A desktop
// allow-rule that broadly permits Bash would still let a mobile-initiated agent
// run absolute-path commands outside the worktree (cwd doesn't constrain Bash).
// Hard confinement needs an OS sandbox (sandbox-exec/seccomp) on mobile-origin
// spawns — tracked as a follow-up; the clamp + worktree-scope prompt are the
// interim guard.
export const clampMobilePermissionMode = (mode: ClaudePermissionMode): ClaudePermissionMode =>
  mode === 'plan' ? 'plan' : 'default';
