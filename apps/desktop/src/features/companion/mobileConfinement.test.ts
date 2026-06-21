import { afterEach, describe, expect, it } from 'vitest';
import type { ClaudePermissionMode, SessionId } from '@goodboy/types';
import {
  clampMobilePermissionMode,
  clearMobileSharedSessions,
  isSessionMobileShared,
  markSessionMobileShared,
} from './mobileConfinement';

const sid = (s: string): SessionId => s as SessionId;

afterEach(() => clearMobileSharedSessions());

describe('clampMobilePermissionMode', () => {
  it('preserves read-only plan mode', () => {
    expect(clampMobilePermissionMode('plan')).toBe('plan');
  });

  it('caps every writable mode at default so the phone cannot auto-approve writes', () => {
    const writable: ClaudePermissionMode[] = [
      'default',
      'acceptEdits',
      'bypassPermissions',
      'dontAsk',
    ];
    for (const mode of writable) {
      expect(clampMobilePermissionMode(mode)).toBe('default');
    }
  });

  it('never yields a mode more permissive than default', () => {
    const all: ClaudePermissionMode[] = [
      'plan',
      'default',
      'acceptEdits',
      'bypassPermissions',
      'dontAsk',
    ];
    for (const mode of all) {
      expect(['plan', 'default']).toContain(clampMobilePermissionMode(mode));
    }
  });
});

describe('mobile shared-session registry', () => {
  it('starts empty and marks a session shared', () => {
    expect(isSessionMobileShared(sid('s1'))).toBe(false);
    markSessionMobileShared(sid('s1'));
    expect(isSessionMobileShared(sid('s1'))).toBe(true);
  });

  it('is sticky and idempotent until explicitly cleared (desktop revoke)', () => {
    markSessionMobileShared(sid('s1'));
    markSessionMobileShared(sid('s1'));
    expect(isSessionMobileShared(sid('s1'))).toBe(true);
    clearMobileSharedSessions();
    expect(isSessionMobileShared(sid('s1'))).toBe(false);
  });

  it('confines each session independently', () => {
    markSessionMobileShared(sid('s1'));
    expect(isSessionMobileShared(sid('s1'))).toBe(true);
    expect(isSessionMobileShared(sid('s2'))).toBe(false);
  });
});
