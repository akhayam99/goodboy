import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { encodeAuthRequiredMessage } from '../chat/turn';
import { pendingAgentSignal } from './pendingAgentSignal';

const RUN_ID = 'run-1' as ProviderRunId;
const AT = '2026-01-01T00:00:00.000Z' as IsoDateTime;

const doneEvent = (): TurnEvent => ({ kind: 'done', runId: RUN_ID, at: AT });

const permissionRequest = (toolUseId: string, toolName = 'pnpm test'): TurnEvent => ({
  kind: 'permission_request',
  runId: RUN_ID,
  toolUseId,
  toolName,
  input: {},
  at: AT,
});

const permissionDecision = (
  toolUseId: string,
  decision: 'allow' | 'deny' = 'allow',
): TurnEvent => ({
  kind: 'permission_decision',
  runId: RUN_ID,
  toolUseId,
  decision,
  ruleId: null,
  decidedBy: 'user',
  at: AT,
});

const authError = (): TurnEvent => ({
  kind: 'error',
  runId: RUN_ID,
  message: encodeAuthRequiredMessage({ providerId: 'anthropic', identity: null }),
  at: AT,
});

const plainError = (): TurnEvent => ({
  kind: 'error',
  runId: RUN_ID,
  message: 'the provider rejected the request',
  at: AT,
});

describe('pendingAgentSignal', () => {
  it('finds a permission_request with no decision yet', () => {
    const signal = pendingAgentSignal({ events: [permissionRequest('tool-1')] });
    expect(signal).toEqual({ kind: 'permission', toolUseId: 'tool-1', toolName: 'pnpm test' });
  });

  it('ignores a permission_request already decided', () => {
    const signal = pendingAgentSignal({
      events: [permissionRequest('tool-1'), permissionDecision('tool-1')],
    });
    expect(signal).toBeNull();
  });

  it('finds an auth_required error at the end of the run', () => {
    const signal = pendingAgentSignal({ events: [authError()] });
    expect(signal).toEqual({ kind: 'auth', providerId: 'anthropic' });
  });

  it('ignores a plain error that does not decode as auth_required', () => {
    const signal = pendingAgentSignal({ events: [plainError()] });
    expect(signal).toBeNull();
  });

  it('returns null once the run ended, even after an earlier unresolved request', () => {
    const signal = pendingAgentSignal({ events: [permissionRequest('tool-1'), doneEvent()] });
    expect(signal).toBeNull();
  });

  it('picks the most recent unresolved permission_request over an older one', () => {
    const signal = pendingAgentSignal({
      events: [
        permissionRequest('tool-1'),
        permissionDecision('tool-1'),
        permissionRequest('tool-2', 'rm -rf tmp'),
      ],
    });
    expect(signal).toEqual({ kind: 'permission', toolUseId: 'tool-2', toolName: 'rm -rf tmp' });
  });

  it('returns null with no events', () => {
    expect(pendingAgentSignal({ events: [] })).toBeNull();
  });
});
