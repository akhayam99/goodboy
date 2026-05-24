import type { AgentId, IsoDateTime, ProviderName } from '@goodboy/types';
import {
  computeCostUsd as computeClaudeCost,
  priceFor as claudePriceFor,
} from '../providers/claude/cost';
import { computeCursorCostUsd, cursorPriceFor } from '../providers/cursor/cost';

// Per-turn telemetry slice the engine needs. Sourced from telemetry_records
// rows (see packages/db/src/queries/telemetry.ts). Codex rows are accepted
// for completeness but never produce a positive counterfactual cost — Codex
// pricing is unmetered (overrides only) so we score it at 0 to avoid
// confusing the user with imaginary numbers.
export interface TurnTelemetry {
  readonly agentId: AgentId | null;
  readonly provider: ProviderName;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly cacheCreation5mTokens: number;
  readonly cacheCreation1hTokens: number;
  readonly estimatedCostUsd: number;
  readonly completedAt: IsoDateTime;
  // 'turn' rows participate in the counterfactual. 'summarizer' rows are
  // session-level overhead — included in real cost, excluded from the
  // counterfactual delta (re-running the summarizer in a "single chat"
  // wouldn't change anything).
  readonly kind: 'turn' | 'summarizer';
}

export interface CounterfactualOptions {
  // 0 = pessimistic (no cache, every reread paid at full input rate).
  // 1 = optimistic (every reread served from cache at 0.1× rate).
  // Default 0.9 matches typical Claude 1h-cache behavior for a single chat
  // that stays warm under continuous use, slightly haircut for context
  // shifts and tool-result invalidations.
  readonly cacheHitRate: number;
}

export interface CounterfactualPerTurn {
  readonly agentId: AgentId | null;
  readonly provider: ProviderName;
  readonly model: string;
  readonly completedAt: IsoDateTime;
  // Cost the user actually paid for this turn.
  readonly realCostUsd: number;
  // Marginal cost from previously-completed other-agent turns being
  // re-included as input context if everything had been one chat.
  readonly extraCostUsd: number;
}

export interface CounterfactualResult {
  readonly realCostUsd: number;
  readonly counterfactualCostUsd: number;
  readonly perTurn: ReadonlyArray<CounterfactualPerTurn>;
  // Total tokens that would have been re-paid (uncached) under the
  // optimistic assumption. Useful for tooltips.
  readonly extraInputTokensTotal: number;
}

const DEFAULT_OPTS: CounterfactualOptions = { cacheHitRate: 0.9 };

// Returns the price.input rate the counterfactual should use for this
// (provider, model) — the same rate the user is already being billed at, so
// "if all in one chat" stays comparable to the real number.
function effectiveInputRate(provider: ProviderName, model: string, cacheHitRate: number): number {
  if (provider === 'anthropic') {
    const p = claudePriceFor(model);
    return cacheHitRate * p.cachedInputPerMtok + (1 - cacheHitRate) * p.inputPerMtok;
  }
  if (provider === 'cursor') {
    const p = cursorPriceFor(model);
    return cacheHitRate * p.cachedInputPerMtok + (1 - cacheHitRate) * p.inputPerMtok;
  }
  // codex: unmetered. Effective rate is 0 — Codex turns produce no
  // counterfactual extra cost. This is deliberate (otherwise we'd have to
  // model Codex pricing too, which is unknown).
  return 0;
}

// Per-turn input token "weight" the counterfactual treats as carry-forward
// when computing what later turns would have to re-process. We sum the raw
// new content (inputTokens minus cache reads and writes — i.e. what was
// fresh on the wire when the user ran the turn) plus all output tokens
// (assistant messages stay in context for subsequent turns).
function carryWeightForTurn(t: TurnTelemetry): number {
  const writes = t.cacheCreation5mTokens + t.cacheCreation1hTokens;
  const freshInput = Math.max(0, t.inputTokens - t.cachedInputTokens - writes);
  return freshInput + t.outputTokens;
}

/**
 * Counterfactual cost: "what would the user have paid if every turn across
 * every agent had been one single ballooning chat instead of N parallel
 * agents?"
 *
 * Math: for each turn t completed at time T by agent k, the extra input
 * tokens that would have been added are the sum of carryWeightForTurn(j)
 * for every turn j (across all OTHER agents) that completed before T. Those
 * extra tokens are priced at the effective input rate of turn t's model
 * (which respects cache assumptions).
 *
 * The result is real_cost + sum_t(extra_cost_t).
 *
 * Skip: 'summarizer' rows (session-level overhead; rerunning them in a
 * single chat changes nothing) and turns missing an agentId (we can't
 * attribute them to a specific agent so we can't tell whether they
 * contribute to the per-agent delta).
 */
export function counterfactualCost(
  turns: ReadonlyArray<TurnTelemetry>,
  opts: CounterfactualOptions = DEFAULT_OPTS,
): CounterfactualResult {
  // Stable chronological order. Same timestamp ties → preserve input order.
  const ordered = [...turns].sort((a, b) =>
    a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : 0,
  );

  // Carry weight contributed by every agent up to (but not including) the
  // current turn. Updated incrementally so the total stays O(n).
  const carryByAgent = new Map<AgentId | 'unknown', number>();

  let realTotal = 0;
  let extraTotal = 0;
  let extraTokensTotal = 0;
  const perTurn: CounterfactualPerTurn[] = [];

  for (const t of ordered) {
    realTotal += t.estimatedCostUsd;

    if (t.kind !== 'turn' || t.agentId === null) {
      // Still bumps real cost (above), but no agent attribution → cannot
      // contribute to or consume the counterfactual delta.
      continue;
    }

    const myAgentKey = t.agentId;
    const myCarry = carryByAgent.get(myAgentKey) ?? 0;

    // Extra tokens that the counterfactual would have re-fed to THIS turn:
    // everything in the total carry pool MINUS what my own agent has
    // contributed (since those tokens were already in MY context).
    let totalCarry = 0;
    for (const w of carryByAgent.values()) totalCarry += w;
    const otherAgentsCarry = Math.max(0, totalCarry - myCarry);
    extraTokensTotal += otherAgentsCarry;

    const rate = effectiveInputRate(t.provider, t.model, opts.cacheHitRate);
    const extraCost = (otherAgentsCarry * rate) / 1_000_000;
    extraTotal += extraCost;

    perTurn.push({
      agentId: t.agentId,
      provider: t.provider,
      model: t.model,
      completedAt: t.completedAt,
      realCostUsd: t.estimatedCostUsd,
      extraCostUsd: extraCost,
    });

    // After scoring this turn, append its own carry weight to the pool so
    // it contributes to subsequent turns' deltas.
    carryByAgent.set(myAgentKey, myCarry + carryWeightForTurn(t));
  }

  return {
    realCostUsd: realTotal,
    counterfactualCostUsd: realTotal + extraTotal,
    perTurn,
    extraInputTokensTotal: extraTokensTotal,
  };
}

// Cost-per-turn helper used by the in-chat hint badge (Phase 5 / future).
// Exposed for unit tests so the in-chat math can be verified independently.
export function turnRealCost(t: TurnTelemetry): number {
  if (t.provider === 'anthropic') {
    return computeClaudeCost(
      {
        inputTokens: t.inputTokens,
        outputTokens: t.outputTokens,
        cachedInputTokens: t.cachedInputTokens,
        cacheCreation5mTokens: t.cacheCreation5mTokens,
        cacheCreation1hTokens: t.cacheCreation1hTokens,
        estimatedCostUsd: 0,
      },
      t.model,
    );
  }
  if (t.provider === 'cursor') {
    return computeCursorCostUsd(
      {
        inputTokens: t.inputTokens,
        outputTokens: t.outputTokens,
        cachedInputTokens: t.cachedInputTokens,
        cacheCreation5mTokens: t.cacheCreation5mTokens,
        cacheCreation1hTokens: t.cacheCreation1hTokens,
        estimatedCostUsd: 0,
      },
      t.model,
    );
  }
  return 0;
}
