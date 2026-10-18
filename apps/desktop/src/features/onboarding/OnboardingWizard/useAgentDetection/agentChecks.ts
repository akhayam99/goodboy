import { formatError } from '@goodboy/ui';
import type {
  AgentProviderId,
  ProbeAgentParams,
} from '../../../../store/slices/providers/probeAgent';
import { AGENT_ROW_IDS } from '../agentRowIds';

export type AgentCheck = {
  readonly isChecking: boolean;
  readonly failure: string | null;
};

export type AgentChecks = Readonly<Record<AgentProviderId, AgentCheck>>;

type Probe = (params: ProbeAgentParams) => Promise<void>;

type CheckParams = {
  readonly providerId: AgentProviderId;
};

export type AgentCheckEngine = {
  readonly snapshot: () => AgentChecks;
  readonly subscribe: (listener: () => void) => () => void;
  readonly check: (params: CheckParams) => void;
  readonly checkIdle: () => void;
};

const IDLE_CHECK: AgentCheck = { isChecking: false, failure: null };

const idleChecks = (): AgentChecks => ({
  anthropic: IDLE_CHECK,
  codex: IDLE_CHECK,
  cursor: IDLE_CHECK,
  gemini: IDLE_CHECK,
});

type EngineParams = {
  readonly probe: Probe;
};

type WriteParams = CheckParams & {
  readonly next: AgentCheck;
};

const createEngine = ({ probe }: EngineParams): AgentCheckEngine => {
  const seqs = new Map<AgentProviderId, number>();
  const inFlight = new Map<AgentProviderId, Promise<void>>();
  const listeners = new Set<() => void>();
  let checks = idleChecks();

  const write = ({ providerId, next }: WriteParams) => {
    checks = { ...checks, [providerId]: next };
    listeners.forEach((listener) => listener());
  };

  const check = ({ providerId }: CheckParams) => {
    const seq = (seqs.get(providerId) ?? 0) + 1;
    seqs.set(providerId, seq);
    const isCurrent = () => seqs.get(providerId) === seq;
    const prior = inFlight.get(providerId) ?? Promise.resolve();
    const start = () => (isCurrent() ? probe({ providerId, isCurrent }) : undefined);
    const run = prior.then(start, start);
    inFlight.set(providerId, run);
    write({ providerId, next: { isChecking: true, failure: checks[providerId].failure } });
    run
      .then(() => {
        if (isCurrent()) {
          write({ providerId, next: IDLE_CHECK });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent()) {
          write({ providerId, next: { isChecking: false, failure: formatError(error) } });
        }
      })
      .finally(() => {
        if (inFlight.get(providerId) === run) {
          inFlight.delete(providerId);
        }
      });
  };

  return {
    snapshot: () => checks,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    check,
    checkIdle: () => {
      AGENT_ROW_IDS.filter((providerId) => !inFlight.has(providerId)).forEach((providerId) =>
        check({ providerId }),
      );
    },
  };
};

const engines = new WeakMap<Probe, AgentCheckEngine>();

export const agentCheckEngine = ({ probe }: EngineParams): AgentCheckEngine => {
  const existing = engines.get(probe);
  if (existing !== undefined) {
    return existing;
  }
  const created = createEngine({ probe });
  engines.set(probe, created);
  return created;
};
