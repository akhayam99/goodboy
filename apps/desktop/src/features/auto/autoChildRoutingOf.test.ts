import { describe, expect, it } from 'vitest';
import { aDelegation } from './testing/autoViewFixtures';
import { autoChildRoutingOf } from './autoChildRoutingOf';

describe('autoChildRoutingOf', () => {
  it('pins the child to the provider, model and effort Auto chose', () => {
    const delegation = aDelegation({
      key: 'implementer',
      role: 'implementer',
      state: 'starting',
      model: 'sonnet-5.5',
      effort: 'medium',
    });

    expect(autoChildRoutingOf({ delegation })).toEqual({
      providerOverride: 'anthropic',
      modelOverride: 'sonnet-5.5',
      effort: 'medium',
    });
  });

  it('leaves out what the routing does not name or names wrongly', () => {
    expect(
      autoChildRoutingOf({ delegation: { routing: { provider: 'acme', effort: 'fast' } } }),
    ).toEqual({});
  });
});
