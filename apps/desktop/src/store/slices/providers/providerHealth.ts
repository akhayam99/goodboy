import type { ProviderHealthStanding, ProviderId } from '@goodboy/types';
import type { AuthState, ProviderStatus } from '../../../features/providers/providers';

const PROBE_FAILURE_WINDOW_MS = 10 * 60_000;
const PROBE_FAILURES_TO_CANNOT_CHECK = 3;
export const SIGNED_OUT_CONFIRM_MS = 10_000;
const SIGNED_OUT_PENDING_STALE_MS = 10 * 60_000;
const REFUSAL_WINDOW_MS = 10 * 60_000;
export const REFUSALS_TO_OPEN_BREAKER = 3;
const HEALTH_EVENT_RING = 50;

export type ProbeOutcome =
  | {
      readonly kind: 'good';
      readonly localTokens: boolean;
      readonly serverAccepted: boolean;
      readonly identity: string | null;
    }
  | { readonly kind: 'signed_out' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'no_answer'; readonly reason: string | null };

type ProbeOutcomeKind = ProbeOutcome['kind'];

export type RunOutcome = 'accepted' | 'refused';

export type HealthEvidence = {
  readonly localTokens: boolean;
  readonly serverAccepted: boolean;
  readonly lastProbeAt: number | null;
  readonly lastProbeOutcome: ProbeOutcomeKind | null;
  readonly lastGoodAt: number | null;
  readonly lastRunOutcome: RunOutcome | null;
  readonly lastRunAt: number | null;
};

export type HealthEvent = {
  readonly at: number;
  readonly from: ProviderHealthStanding;
  readonly to: ProviderHealthStanding;
  readonly reason: string;
};

export type ProviderHealth = {
  readonly standing: ProviderHealthStanding;
  readonly evidence: HealthEvidence;
  readonly probeFailures: ReadonlyArray<number>;
  readonly refusals: ReadonlyArray<number>;
  readonly isBreakerOpen: boolean;
  readonly pendingSignedOutAt: number | null;
  readonly identity: string | null;
  readonly lastRefusal: string | null;
  readonly events: ReadonlyArray<HealthEvent>;
};

export type ProviderHealthMap = Readonly<Record<ProviderId, ProviderHealth>>;

export type HealthAction =
  | {
      readonly type: 'probe';
      readonly at: number;
      readonly outcome: ProbeOutcome;
      readonly isImmediate?: boolean;
    }
  | {
      readonly type: 'run';
      readonly at: number;
      readonly outcome: RunOutcome;
      readonly message?: string;
    }
  | { readonly type: 'signed_in'; readonly at: number };

export type HealthResult = {
  readonly health: ProviderHealth;
  readonly events: ReadonlyArray<HealthEvent>;
};

export const INITIAL_EVIDENCE: HealthEvidence = {
  localTokens: false,
  serverAccepted: false,
  lastProbeAt: null,
  lastProbeOutcome: null,
  lastGoodAt: null,
  lastRunOutcome: null,
  lastRunAt: null,
};

export const INITIAL_HEALTH: ProviderHealth = {
  standing: 'unknown',
  evidence: INITIAL_EVIDENCE,
  probeFailures: [],
  refusals: [],
  isBreakerOpen: false,
  pendingSignedOutAt: null,
  identity: null,
  lastRefusal: null,
  events: [],
};

export const INITIAL_HEALTH_MAP: ProviderHealthMap = {
  anthropic: INITIAL_HEALTH,
  cursor: INITIAL_HEALTH,
  codex: INITIAL_HEALTH,
  gemini: INITIAL_HEALTH,
  opencode: INITIAL_HEALTH,
  openrouter: INITIAL_HEALTH,
  moonshot: INITIAL_HEALTH,
};

type WithinParams = {
  readonly stamps: ReadonlyArray<number>;
  readonly at: number;
  readonly windowMs: number;
};

const within = ({ stamps, at, windowMs }: WithinParams): ReadonlyArray<number> =>
  stamps.filter((stamp) => at - stamp < windowMs);

type WithEventsParams = {
  readonly health: ProviderHealth;
  readonly event: HealthEvent | null;
};

const withEvent = ({ health, event }: WithEventsParams): HealthResult => {
  if (event === null) {
    return { health, events: [] };
  }
  return {
    health: { ...health, events: [...health.events, event].slice(-HEALTH_EVENT_RING) },
    events: [event],
  };
};

type MoveParams = {
  readonly health: ProviderHealth;
  readonly to: ProviderHealthStanding;
  readonly at: number;
  readonly reason: string;
};

const moveTo = ({ health, to, at, reason }: MoveParams): HealthResult => {
  if (health.standing === to) {
    return { health, events: [] };
  }
  return withEvent({
    health: { ...health, standing: to },
    event: { at, from: health.standing, to, reason },
  });
};

type ProbeParams = {
  readonly health: ProviderHealth;
  readonly at: number;
  readonly outcome: ProbeOutcome;
  readonly isImmediate: boolean;
};

const hasGoodHistory = ({ health }: Pick<ProbeParams, 'health'>): boolean =>
  health.evidence.lastGoodAt !== null;

const reduceProbe = ({ health, at, outcome, isImmediate }: ProbeParams): HealthResult => {
  const base: ProviderHealth = {
    ...health,
    evidence: { ...health.evidence, lastProbeAt: at, lastProbeOutcome: outcome.kind },
  };
  if (outcome.kind === 'good') {
    const next: ProviderHealth = {
      ...base,
      probeFailures: [],
      pendingSignedOutAt: null,
      identity: outcome.identity ?? base.identity,
      evidence: {
        ...base.evidence,
        localTokens: outcome.localTokens,
        serverAccepted: outcome.serverAccepted,
        lastGoodAt: at,
      },
    };
    const reason = health.standing === 'cannot_check' ? 'probe answered again' : 'probe confirmed';
    return moveTo({ health: next, to: 'connected', at, reason });
  }
  if (outcome.kind === 'missing') {
    return moveTo({
      health: { ...base, probeFailures: [], pendingSignedOutAt: null },
      to: 'missing',
      at,
      reason: 'binary not found',
    });
  }
  if (outcome.kind === 'no_answer') {
    const failures = [
      ...within({ stamps: health.probeFailures, at, windowMs: PROBE_FAILURE_WINDOW_MS }),
      at,
    ];
    const next: ProviderHealth = { ...base, probeFailures: failures };
    if (failures.length < PROBE_FAILURES_TO_CANNOT_CHECK) {
      return { health: next, events: [] };
    }
    return moveTo({
      health: next,
      to: 'cannot_check',
      at,
      reason: outcome.reason ?? 'probe gave no answer 3 times in 10 minutes',
    });
  }
  const answered: ProviderHealth = { ...base, probeFailures: [] };
  if (health.standing === 'signed_out') {
    return { health: { ...answered, pendingSignedOutAt: null }, events: [] };
  }
  const isFirm =
    isImmediate ||
    !hasGoodHistory({ health }) ||
    health.standing === 'unknown' ||
    health.standing === 'missing';
  if (isFirm) {
    return moveTo({
      health: { ...answered, pendingSignedOutAt: null },
      to: 'signed_out',
      at,
      reason: isImmediate ? 'signed out by Goodboy' : 'not logged in',
    });
  }
  const pending = health.pendingSignedOutAt;
  const isPendingLive = pending !== null && at - pending < SIGNED_OUT_PENDING_STALE_MS;
  if (isPendingLive && at - pending >= SIGNED_OUT_CONFIRM_MS) {
    return moveTo({
      health: { ...answered, pendingSignedOutAt: null },
      to: 'signed_out',
      at,
      reason: 'not logged in twice',
    });
  }
  return {
    health: { ...answered, pendingSignedOutAt: isPendingLive ? pending : at },
    events: [],
  };
};

type RunParams = {
  readonly health: ProviderHealth;
  readonly at: number;
  readonly outcome: RunOutcome;
  readonly message: string | null;
};

const REFUSAL_MESSAGE_CAP = 500;

const reduceRun = ({ health, at, outcome, message }: RunParams): HealthResult => {
  if (outcome === 'refused') {
    const refusals = [...within({ stamps: health.refusals, at, windowMs: REFUSAL_WINDOW_MS }), at];
    const isOpening = !health.isBreakerOpen && refusals.length >= REFUSALS_TO_OPEN_BREAKER;
    const next: ProviderHealth = {
      ...health,
      refusals,
      lastRefusal: message === null ? health.lastRefusal : message.slice(0, REFUSAL_MESSAGE_CAP),
      isBreakerOpen: health.isBreakerOpen || isOpening,
      evidence: { ...health.evidence, lastRunOutcome: 'refused', lastRunAt: at },
    };
    if (!isOpening) {
      return { health: next, events: [] };
    }
    return withEvent({
      health: next,
      event: {
        at,
        from: health.standing,
        to: health.standing,
        reason: 'three runs refused in 10 minutes, breaker open',
      },
    });
  }
  const next: ProviderHealth = {
    ...health,
    refusals: [],
    isBreakerOpen: false,
    probeFailures: [],
    pendingSignedOutAt: null,
    evidence: {
      ...health.evidence,
      serverAccepted: true,
      lastGoodAt: at,
      lastRunOutcome: 'accepted',
      lastRunAt: at,
    },
  };
  const moved = moveTo({ health: next, to: 'connected', at, reason: 'a run was accepted' });
  if (!health.isBreakerOpen) {
    return moved;
  }
  const closed = withEvent({
    health: moved.health,
    event: {
      at,
      from: health.standing,
      to: moved.health.standing,
      reason: 'a run was accepted, breaker closed',
    },
  });
  return { health: closed.health, events: [...moved.events, ...closed.events] };
};

type ReduceParams = {
  readonly health: ProviderHealth;
  readonly action: HealthAction;
};

export const reduceProviderHealth = ({ health, action }: ReduceParams): HealthResult => {
  if (action.type === 'probe') {
    return reduceProbe({
      health,
      at: action.at,
      outcome: action.outcome,
      isImmediate: action.isImmediate === true,
    });
  }
  if (action.type === 'run') {
    return reduceRun({
      health,
      at: action.at,
      outcome: action.outcome,
      message: action.message ?? null,
    });
  }
  const closed: ProviderHealth = {
    ...health,
    refusals: [],
    isBreakerOpen: false,
    pendingSignedOutAt: null,
  };
  if (!health.isBreakerOpen) {
    return { health: closed, events: [] };
  }
  return withEvent({
    health: closed,
    event: {
      at: action.at,
      from: health.standing,
      to: health.standing,
      reason: 'signed in again, breaker closed',
    },
  });
};

type OutcomeParams = {
  readonly id: ProviderId;
  readonly status: ProviderStatus | null;
  readonly auth: AuthState | null;
  readonly hasCredential: boolean;
  readonly isApi: boolean;
};

type StatusParams = {
  readonly status: ProviderStatus;
};

const statusOutcome = ({ status }: StatusParams): ProbeOutcome | null => {
  if (status.available) {
    return null;
  }
  if (status.errorKind === 'timeout' || status.errorKind === 'exit') {
    return { kind: 'no_answer', reason: status.error };
  }
  return { kind: 'missing' };
};

export const probeOutcomeOf = ({
  id,
  status,
  auth,
  hasCredential,
  isApi,
}: OutcomeParams): ProbeOutcome | null => {
  if (status === null) {
    return null;
  }
  const unavailable = statusOutcome({ status });
  if (unavailable !== null) {
    return unavailable;
  }
  if (isApi) {
    return hasCredential
      ? { kind: 'good', localTokens: true, serverAccepted: true, identity: null }
      : { kind: 'signed_out' };
  }
  if (id === 'opencode') {
    return {
      kind: 'good',
      localTokens: true,
      serverAccepted: true,
      identity: auth?.identity ?? null,
    };
  }
  if (id === 'gemini' && hasCredential) {
    return {
      kind: 'good',
      localTokens: true,
      serverAccepted: true,
      identity: auth?.identity ?? null,
    };
  }
  if (auth === null || auth.state === 'unknown') {
    return { kind: 'no_answer', reason: auth?.reason ?? null };
  }
  if (auth.state === 'disconnected') {
    return { kind: 'signed_out' };
  }
  return {
    kind: 'good',
    localTokens: true,
    serverAccepted: auth.verified !== false,
    identity: auth.identity,
  };
};

type HealthParams = {
  readonly health: ProviderHealth;
};

export const connectionOfHealth = ({
  health,
}: HealthParams):
  'connected' | 'installed_disconnected' | 'missing' | 'unknown' | 'cannot_check' => {
  switch (health.standing) {
    case 'connected':
      return 'connected';
    case 'signed_out':
      return 'installed_disconnected';
    case 'missing':
      return 'missing';
    case 'unknown':
      return 'unknown';
    case 'cannot_check':
      return health.evidence.lastGoodAt === null ? 'cannot_check' : 'connected';
  }
};

const isHealthUnhealthy = ({ health }: HealthParams): boolean =>
  health.isBreakerOpen ||
  health.standing === 'cannot_check' ||
  (health.standing === 'signed_out' && health.evidence.lastGoodAt !== null);

type MapParams = {
  readonly map: ProviderHealthMap;
};

export const hasUnhealthyProvider = ({ map }: MapParams): boolean =>
  Object.values(map).some((health) => isHealthUnhealthy({ health }));

type StaleParams = HealthParams & {
  readonly nowMs: number;
  readonly maxAgeMs: number;
};

export const isConfirmationStale = ({ health, nowMs, maxAgeMs }: StaleParams): boolean =>
  health.evidence.lastGoodAt === null || nowMs - health.evidence.lastGoodAt > maxAgeMs;

export const hasPendingSignedOut = ({ map }: MapParams): boolean =>
  Object.values(map).some((health) => health.pendingSignedOutAt !== null);
