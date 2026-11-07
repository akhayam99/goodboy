import { describe, expect, it } from 'vitest';
import { CommandError } from '../../../shared/lib/invokeCommand';
import type { HostFailure, HostFailureKind } from '../../../shared/lib/hostFailure';
import { CHECK_STATE } from './errorRecovery';
import { hostErrorRecoveryOf } from './hostErrorRecovery';

type Params = {
  readonly kind: HostFailureKind;
};

const failureOf = ({ kind }: Params): HostFailure => ({
  kind,
  status: null,
  retryAfterSeconds: null,
  detail: null,
});

const commandErrorOf = ({ kind }: Params): CommandError =>
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
    ).toEqual(CHECK_STATE);
    expect(
      hostErrorRecoveryOf({ error: commandErrorOf({ kind: 'rate_limited' }), tool: 'gitlab' }),
    ).toEqual(CHECK_STATE);
    expect(hostErrorRecoveryOf({ error: new Error('boom'), tool: 'gitlab' })).toEqual(CHECK_STATE);
  });
});
