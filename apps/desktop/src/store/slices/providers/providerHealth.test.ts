// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ProviderHealthStanding } from '@goodboy/types';
import {
  INITIAL_HEALTH,
  connectionOfHealth,
  hasUnhealthyProvider,
  INITIAL_HEALTH_MAP,
  isConfirmationStale,
  probeOutcomeOf,
  reduceProviderHealth,
  type HealthAction,
  type ProbeOutcome,
  type ProviderHealth,
} from './providerHealth';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

const good: ProbeOutcome = {
  kind: 'good',
  localTokens: true,
  serverAccepted: true,
  identity: 'ada@harborline.dev',
};
const localOnly: ProbeOutcome = {
  kind: 'good',
  localTokens: true,
  serverAccepted: false,
  identity: null,
};
const signedOut: ProbeOutcome = { kind: 'signed_out' };
const silent: ProbeOutcome = { kind: 'no_answer', reason: 'timed out' };
const missing: ProbeOutcome = { kind: 'missing' };

const probe = (at: number, outcome: ProbeOutcome, isImmediate = false): HealthAction => ({
  type: 'probe',
  at,
  outcome,
  isImmediate,
});
const refused = (at: number): HealthAction => ({
  type: 'run',
  at,
  outcome: 'refused',
  message: 'Authentication required',
});
const accepted = (at: number): HealthAction => ({ type: 'run', at, outcome: 'accepted' });
const signedIn = (at: number): HealthAction => ({ type: 'signed_in', at });

const play = (actions: ReadonlyArray<HealthAction>): ProviderHealth =>
  actions.reduce<ProviderHealth>(
    (health, action) => reduceProviderHealth({ health, action }).health,
    INITIAL_HEALTH,
  );

type Row = {
  readonly name: string;
  readonly actions: ReadonlyArray<HealthAction>;
  readonly standing: ProviderHealthStanding;
  readonly isBreakerOpen: boolean;
};

const ROWS: ReadonlyArray<Row> = [
  {
    name: 'a good probe connects',
    actions: [probe(0, good)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'local tokens only still connect',
    actions: [probe(0, localOnly)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'a first not logged in with no history is taken at once',
    actions: [probe(0, signedOut)],
    standing: 'signed_out',
    isBreakerOpen: false,
  },
  {
    name: 'one not logged in after a good probe changes nothing',
    actions: [probe(0, good), probe(30 * SECOND, signedOut)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'two not logged in 5s apart change nothing',
    actions: [probe(0, good), probe(MINUTE, signedOut), probe(MINUTE + 5 * SECOND, signedOut)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'two not logged in 10s apart sign out',
    actions: [probe(0, good), probe(MINUTE, signedOut), probe(MINUTE + 10 * SECOND, signedOut)],
    standing: 'signed_out',
    isBreakerOpen: false,
  },
  {
    name: 'a good probe between two not logged in resets the pair',
    actions: [
      probe(0, good),
      probe(MINUTE, signedOut),
      probe(MINUTE + 5 * SECOND, good),
      probe(MINUTE + 20 * SECOND, signedOut),
    ],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'a not logged in right after a Goodboy sign-out is taken at once',
    actions: [probe(0, good), probe(MINUTE, signedOut, true)],
    standing: 'signed_out',
    isBreakerOpen: false,
  },
  {
    name: 'a stale first not logged in does not pair with a late one',
    actions: [probe(0, good), probe(MINUTE, signedOut), probe(20 * MINUTE, signedOut)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'one silent probe changes nothing',
    actions: [probe(0, good), probe(MINUTE, silent)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'two silent probes change nothing',
    actions: [probe(0, good), probe(MINUTE, silent), probe(2 * MINUTE, silent)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'three silent probes in ten minutes cannot check',
    actions: [
      probe(0, good),
      probe(MINUTE, silent),
      probe(2 * MINUTE, silent),
      probe(3 * MINUTE, silent),
    ],
    standing: 'cannot_check',
    isBreakerOpen: false,
  },
  {
    name: 'three silent probes spread over twenty minutes change nothing',
    actions: [
      probe(0, good),
      probe(5 * MINUTE, silent),
      probe(12 * MINUTE, silent),
      probe(20 * MINUTE, silent),
    ],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'timeout, timeout, ok stays connected',
    actions: [
      probe(0, good),
      probe(MINUTE, silent),
      probe(2 * MINUTE, silent),
      probe(3 * MINUTE, good),
    ],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'a good probe clears cannot check',
    actions: [
      probe(0, silent),
      probe(MINUTE, silent),
      probe(2 * MINUTE, silent),
      probe(3 * MINUTE, good),
    ],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'a silent probe is never missing',
    actions: [probe(0, good), probe(MINUTE, silent)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'a silent probe from nothing stays unknown',
    actions: [probe(0, silent)],
    standing: 'unknown',
    isBreakerOpen: false,
  },
  {
    name: 'a binary not found is missing',
    actions: [probe(0, good), probe(MINUTE, missing)],
    standing: 'missing',
    isBreakerOpen: false,
  },
  {
    name: 'a good probe after missing connects',
    actions: [probe(0, missing), probe(MINUTE, good)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'a not logged in after missing is taken at once',
    actions: [probe(0, good), probe(MINUTE, missing), probe(2 * MINUTE, signedOut)],
    standing: 'signed_out',
    isBreakerOpen: false,
  },
  {
    name: 'signed out then a good probe connects',
    actions: [probe(0, signedOut), probe(MINUTE, good)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'two refusals keep the breaker closed',
    actions: [probe(0, good), refused(MINUTE), refused(2 * MINUTE)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'three refusals in ten minutes open the breaker and keep the probe standing',
    actions: [probe(0, good), refused(MINUTE), refused(2 * MINUTE), refused(3 * MINUTE)],
    standing: 'connected',
    isBreakerOpen: true,
  },
  {
    name: 'three refusals over eleven minutes keep it closed',
    actions: [probe(0, good), refused(MINUTE), refused(6 * MINUTE), refused(12 * MINUTE)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'a run that succeeds closes the breaker',
    actions: [
      probe(0, good),
      refused(MINUTE),
      refused(2 * MINUTE),
      refused(3 * MINUTE),
      accepted(4 * MINUTE),
    ],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'signing in again closes the breaker',
    actions: [
      probe(0, good),
      refused(MINUTE),
      refused(2 * MINUTE),
      refused(3 * MINUTE),
      signedIn(4 * MINUTE),
    ],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'a good probe does not close the breaker',
    actions: [
      probe(0, good),
      refused(MINUTE),
      refused(2 * MINUTE),
      refused(3 * MINUTE),
      probe(4 * MINUTE, good),
    ],
    standing: 'connected',
    isBreakerOpen: true,
  },
  {
    name: 'a success then refusals starts the count again',
    actions: [
      probe(0, good),
      refused(MINUTE),
      refused(2 * MINUTE),
      accepted(3 * MINUTE),
      refused(4 * MINUTE),
      refused(5 * MINUTE),
    ],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'an accepted run on an unknown provider connects it',
    actions: [accepted(0)],
    standing: 'connected',
    isBreakerOpen: false,
  },
  {
    name: 'an accepted run on a signed out provider connects it',
    actions: [probe(0, signedOut), accepted(MINUTE)],
    standing: 'connected',
    isBreakerOpen: false,
  },
];

describe('reduceProviderHealth', () => {
  it.each(ROWS)('$name', ({ actions, standing, isBreakerOpen }) => {
    const health = play(actions);
    expect(health.standing).toBe(standing);
    expect(health.isBreakerOpen).toBe(isBreakerOpen);
  });

  it('keeps the last known identity when a later probe has none', () => {
    const health = play([
      probe(0, good),
      probe(MINUTE, { kind: 'good', localTokens: true, serverAccepted: true, identity: null }),
    ]);
    expect(health.identity).toBe('ada@harborline.dev');
  });

  it('records the raw refusal message for the Details line', () => {
    expect(play([refused(0)]).lastRefusal).toBe('Authentication required');
  });

  it('records local tokens only as not confirmed by the server', () => {
    const { evidence } = play([probe(0, localOnly)]);
    expect([evidence.localTokens, evidence.serverAccepted]).toEqual([true, false]);
  });

  it('marks a successful run as server accepted evidence', () => {
    const health = play([probe(0, localOnly), accepted(MINUTE)]);
    expect(health.evidence.serverAccepted).toBe(true);
    expect(health.evidence.lastRunOutcome).toBe('accepted');
  });

  it('keeps at most fifty events in the ring', () => {
    const flips = Array.from({ length: 80 }, (_, index) =>
      probe(index * MINUTE, index % 2 === 0 ? good : missing),
    );
    const health = play(flips);
    expect(health.events).toHaveLength(50);
    expect(health.events.at(-1)?.at).toBe(79 * MINUTE);
  });

  it('emits one event per standing change and none for a probe that changes nothing', () => {
    const first = reduceProviderHealth({ health: INITIAL_HEALTH, action: probe(0, good) });
    const second = reduceProviderHealth({ health: first.health, action: probe(MINUTE, good) });
    expect(first.events).toHaveLength(1);
    expect(second.events).toHaveLength(0);
  });

  it('emits an event when the breaker opens and when it closes', () => {
    const opened = [probe(0, good), refused(MINUTE), refused(2 * MINUTE), refused(3 * MINUTE)];
    const health = play(opened);
    expect(health.events.at(-1)?.reason).toMatch(/breaker open/);
    const closed = reduceProviderHealth({ health, action: accepted(4 * MINUTE) });
    expect(closed.events.map((event) => event.reason).join('|')).toMatch(/breaker closed/);
  });
});

describe('connectionOfHealth', () => {
  it('reads a cannot check provider with a last good state as connected', () => {
    const health = play([
      probe(0, good),
      probe(MINUTE, silent),
      probe(2 * MINUTE, silent),
      probe(3 * MINUTE, silent),
    ]);
    expect(health.standing).toBe('cannot_check');
    expect(connectionOfHealth({ health })).toBe('connected');
  });

  it('reads a cannot check provider that was never good as cannot_check', () => {
    const health = play([probe(0, silent), probe(MINUTE, silent), probe(2 * MINUTE, silent)]);
    expect(connectionOfHealth({ health })).toBe('cannot_check');
  });

  it.each([
    ['signed_out', 'installed_disconnected'],
    ['missing', 'missing'],
    ['connected', 'connected'],
    ['unknown', 'unknown'],
  ] as const)('maps %s to %s', (standing, connection) => {
    expect(connectionOfHealth({ health: { ...INITIAL_HEALTH, standing } })).toBe(connection);
  });
});

describe('probeOutcomeOf', () => {
  const status = (overrides: Record<string, unknown>) => ({
    id: 'cursor',
    binary: 'cursor-agent',
    available: true,
    version: '1.0.0',
    error: null,
    ...overrides,
  });
  const outcome = (params: {
    readonly status: ReturnType<typeof status> | null;
    readonly auth?: {
      state: 'connected' | 'disconnected' | 'unknown';
      identity: string | null;
      verified?: boolean;
      reason?: string | null;
    } | null;
    readonly id?: 'cursor' | 'opencode' | 'gemini' | 'openrouter';
    readonly hasCredential?: boolean;
    readonly isApi?: boolean;
  }) =>
    probeOutcomeOf({
      id: params.id ?? 'cursor',
      status: params.status,
      auth: params.auth ?? null,
      hasCredential: params.hasCredential ?? false,
      isApi: params.isApi ?? false,
    });

  it('has nothing to say without a status', () => {
    expect(outcome({ status: null })).toBeNull();
  });

  it('reads a timeout as no answer, never as missing', () => {
    expect(
      outcome({ status: status({ available: false, errorKind: 'timeout', error: 'timed out' }) }),
    ).toEqual({ kind: 'no_answer', reason: 'timed out' });
  });

  it('reads a crashed probe as no answer', () => {
    expect(outcome({ status: status({ available: false, errorKind: 'exit' }) })?.kind).toBe(
      'no_answer',
    );
  });

  it('reads only a not found as missing', () => {
    expect(outcome({ status: status({ available: false, errorKind: 'notFound' }) })).toEqual({
      kind: 'missing',
    });
  });

  it('reads an unavailable binary with no kind as missing', () => {
    expect(outcome({ status: status({ available: false }) })).toEqual({ kind: 'missing' });
  });

  it('reads an unknown auth as no answer and keeps its reason', () => {
    expect(
      outcome({ status: status({}), auth: { state: 'unknown', identity: null, reason: 'exit 2' } }),
    ).toEqual({ kind: 'no_answer', reason: 'exit 2' });
  });

  it('reads a missing auth as no answer', () => {
    expect(outcome({ status: status({}) })?.kind).toBe('no_answer');
  });

  it('reads a disconnected auth as signed out', () => {
    expect(
      outcome({ status: status({}), auth: { state: 'disconnected', identity: null } }),
    ).toEqual({ kind: 'signed_out' });
  });

  it('reads a connected auth without server proof as local tokens only', () => {
    expect(
      outcome({
        status: status({}),
        auth: { state: 'connected', identity: 'ada@harborline.dev', verified: false },
      }),
    ).toMatchObject({ kind: 'good', serverAccepted: false });
  });

  it('reads a connected auth with no verified field as accepted', () => {
    expect(
      outcome({ status: status({}), auth: { state: 'connected', identity: null } }),
    ).toMatchObject({ kind: 'good', serverAccepted: true });
  });

  it('counts opencode as good once installed', () => {
    expect(outcome({ id: 'opencode', status: status({ id: 'opencode' }) })?.kind).toBe('good');
  });

  it('counts a saved key as good for gemini whatever the auth says', () => {
    expect(
      outcome({
        id: 'gemini',
        hasCredential: true,
        status: status({ id: 'gemini' }),
        auth: { state: 'disconnected', identity: null },
      })?.kind,
    ).toBe('good');
  });

  it('reads an API provider by its credential', () => {
    expect(
      outcome({
        id: 'openrouter',
        isApi: true,
        hasCredential: false,
        status: status({ id: 'openrouter' }),
      })?.kind,
    ).toBe('signed_out');
    expect(
      outcome({
        id: 'openrouter',
        isApi: true,
        hasCredential: true,
        status: status({ id: 'openrouter' }),
      })?.kind,
    ).toBe('good');
  });
});

describe('health helpers', () => {
  it('flags a provider that was good and is now signed out as unhealthy, a never connected one as fine', () => {
    const wasGood = play([probe(0, good), probe(MINUTE, signedOut, true)]);
    const neverGood = play([probe(0, signedOut)]);
    expect(hasUnhealthyProvider({ map: { ...INITIAL_HEALTH_MAP, cursor: wasGood } })).toBe(true);
    expect(hasUnhealthyProvider({ map: { ...INITIAL_HEALTH_MAP, cursor: neverGood } })).toBe(false);
  });

  it('flags an open breaker and a cannot check provider as unhealthy', () => {
    const breaker = play([probe(0, good), refused(1), refused(2), refused(3)]);
    expect(hasUnhealthyProvider({ map: { ...INITIAL_HEALTH_MAP, cursor: breaker } })).toBe(true);
  });

  it('says a confirmation older than the limit is stale, and a missing one too', () => {
    const health = play([probe(0, good)]);
    expect(isConfirmationStale({ health, nowMs: 30 * SECOND, maxAgeMs: MINUTE })).toBe(false);
    expect(isConfirmationStale({ health, nowMs: 2 * MINUTE, maxAgeMs: MINUTE })).toBe(true);
    expect(isConfirmationStale({ health: INITIAL_HEALTH, nowMs: 0, maxAgeMs: MINUTE })).toBe(true);
  });
});
