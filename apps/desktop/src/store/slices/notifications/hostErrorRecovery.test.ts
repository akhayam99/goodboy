import { describe, expect, it } from 'vitest';
import { CommandError } from '../../../shared/lib/invokeCommand';
import type { HostFailure, HostFailureKind } from '../../../shared/lib/hostFailure';
import { hostErrorRecoveryOf } from './hostErrorRecovery';

const failureOf = ({ kind }: { kind: HostFailureKind }): HostFailure => ({
  kind,
  status: null,
  retryAfterSeconds: null,
  detail: null,
});

const commandErrorOf = ({ kind }: { kind: HostFailureKind }): CommandError =>
  new CommandError({ kind: 'host', message: 'request failed', failure: failureOf({ kind }) });

describe('hostErrorRecoveryOf', () => {
  it('sends a rejected sign-in to the tool settings', () => {
    expect(
      hostErrorRecoveryOf({ error: commandErrorOf({ kind: 'bad_credentials' }), tool: 'gitlab' }),
    ).toEqual({ action: { kind: 'open-settings', scope: 'tools', tool: 'gitlab' } });
    expect(
      hostErrorRecoveryOf({ error: commandErrorOf({ kind: 'denied' }), tool: 'linear' }),
    ).toEqual({ action: { kind: 'open-settings', scope: 'tools', tool: 'linear' } });
  });

  it('promises nothing for a failure that signing in again would not fix', () => {
    expect(
      hostErrorRecoveryOf({ error: commandErrorOf({ kind: 'network' }), tool: 'gitlab' }),
    ).toBeUndefined();
    expect(
      hostErrorRecoveryOf({ error: commandErrorOf({ kind: 'rate_limited' }), tool: 'gitlab' }),
    ).toBeUndefined();
    expect(hostErrorRecoveryOf({ error: new Error('boom'), tool: 'gitlab' })).toBeUndefined();
  });
});
