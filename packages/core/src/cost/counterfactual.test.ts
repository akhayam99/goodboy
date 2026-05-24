import { describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime } from '@goodboy/types';
import { counterfactualCost, type TurnTelemetry } from './counterfactual';

function turn(p: {
  agentId: string | null;
  at: string;
  model: string;
  provider: 'anthropic' | 'cursor' | 'codex';
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheCreation5mTokens?: number;
  cacheCreation1hTokens?: number;
  estimatedCostUsd: number;
  kind?: 'turn' | 'summarizer';
}): TurnTelemetry {
  return {
    agentId: p.agentId === null ? null : (p.agentId as AgentId),
    provider: p.provider,
    model: p.model,
    inputTokens: p.inputTokens,
    outputTokens: p.outputTokens,
    cachedInputTokens: p.cachedInputTokens ?? 0,
    cacheCreation5mTokens: p.cacheCreation5mTokens ?? 0,
    cacheCreation1hTokens: p.cacheCreation1hTokens ?? 0,
    estimatedCostUsd: p.estimatedCostUsd,
    completedAt: p.at as IsoDateTime,
    kind: p.kind ?? 'turn',
  };
}

describe('counterfactualCost', () => {
  it('returns real cost when there is only one agent (no extras)', () => {
    const result = counterfactualCost([
      turn({
        agentId: 'a1',
        at: '2026-05-01T00:00:00Z',
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCostUsd: 0.0105,
      }),
      turn({
        agentId: 'a1',
        at: '2026-05-01T00:01:00Z',
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        inputTokens: 2000,
        outputTokens: 800,
        estimatedCostUsd: 0.018,
      }),
    ]);
    expect(result.realCostUsd).toBeCloseTo(0.0285);
    expect(result.counterfactualCostUsd).toBeCloseTo(0.0285);
    expect(result.extraInputTokensTotal).toBe(0);
  });

  it('adds extra cost when later turn happens in a different agent', () => {
    // Agent A runs a heavy turn first (10k input + 5k output = 15k carry).
    // Agent B then runs a cheap turn — counterfactual: B would re-read those
    // 15k tokens as part of its context.
    const result = counterfactualCost(
      [
        turn({
          agentId: 'a',
          at: '2026-05-01T00:00:00Z',
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          inputTokens: 10_000,
          outputTokens: 5_000,
          estimatedCostUsd: 0.105,
        }),
        turn({
          agentId: 'b',
          at: '2026-05-01T00:01:00Z',
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          inputTokens: 1000,
          outputTokens: 200,
          estimatedCostUsd: 0.006,
        }),
      ],
      { cacheHitRate: 0.9 },
    );
    expect(result.realCostUsd).toBeCloseTo(0.111);
    // extra = 15_000 tokens * (0.9 * $0.3 + 0.1 * $3) / 1M = 15_000 * 0.57 / 1M = $0.00855
    const expectedExtra = (15_000 * (0.9 * 0.3 + 0.1 * 3)) / 1_000_000;
    expect(result.counterfactualCostUsd).toBeCloseTo(0.111 + expectedExtra);
    expect(result.extraInputTokensTotal).toBe(15_000);
  });

  it('orders chronologically regardless of input array order', () => {
    const earlier = turn({
      agentId: 'a',
      at: '2026-05-01T00:00:00Z',
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      inputTokens: 1000,
      outputTokens: 500,
      estimatedCostUsd: 0.01,
    });
    const later = turn({
      agentId: 'b',
      at: '2026-05-01T00:01:00Z',
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      inputTokens: 1000,
      outputTokens: 500,
      estimatedCostUsd: 0.01,
    });
    // Pass later before earlier — engine should still order them
    // chronologically so `later` sees `earlier` in its carry pool.
    const result = counterfactualCost([later, earlier], { cacheHitRate: 0 });
    // No cache → extra = 1500 * $3 / 1M = $0.0045
    expect(result.counterfactualCostUsd - result.realCostUsd).toBeCloseTo(0.0045);
  });

  it('skips summarizer rows from the counterfactual delta but counts their real cost', () => {
    const result = counterfactualCost([
      turn({
        agentId: 'a',
        at: '2026-05-01T00:00:00Z',
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCostUsd: 0.01,
      }),
      turn({
        agentId: null,
        kind: 'summarizer',
        at: '2026-05-01T00:01:00Z',
        model: 'claude-haiku-4-5',
        provider: 'anthropic',
        inputTokens: 200,
        outputTokens: 100,
        estimatedCostUsd: 0.001,
      }),
      turn({
        agentId: 'b',
        at: '2026-05-01T00:02:00Z',
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        inputTokens: 1000,
        outputTokens: 200,
        estimatedCostUsd: 0.005,
      }),
    ]);
    // real = 0.01 + 0.001 + 0.005 = 0.016
    expect(result.realCostUsd).toBeCloseTo(0.016);
    // extra should only count agent A's 1500 carry (summarizer's 300 ignored)
    expect(result.extraInputTokensTotal).toBe(1500);
  });

  it('codex turns produce no counterfactual extra (unmetered)', () => {
    const result = counterfactualCost([
      turn({
        agentId: 'a',
        at: '2026-05-01T00:00:00Z',
        model: 'gpt-5.5',
        provider: 'codex',
        inputTokens: 10_000,
        outputTokens: 5_000,
        estimatedCostUsd: 0,
      }),
      turn({
        agentId: 'b',
        at: '2026-05-01T00:01:00Z',
        model: 'gpt-5.5',
        provider: 'codex',
        inputTokens: 1000,
        outputTokens: 200,
        estimatedCostUsd: 0,
      }),
    ]);
    // codex effective input rate is 0 → no extra cost regardless of carry.
    expect(result.counterfactualCostUsd).toBe(0);
    expect(result.realCostUsd).toBe(0);
    // But carry tokens still accumulate (useful for cross-provider scenarios).
    expect(result.extraInputTokensTotal).toBeGreaterThan(0);
  });

  it('cross-provider: Opus turn after Sonnet turn pays Opus extra rate on Sonnet carry', () => {
    const result = counterfactualCost(
      [
        turn({
          agentId: 'sonnet',
          at: '2026-05-01T00:00:00Z',
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          inputTokens: 10_000,
          outputTokens: 5_000,
          estimatedCostUsd: 0.105,
        }),
        turn({
          agentId: 'opus',
          at: '2026-05-01T00:01:00Z',
          model: 'claude-opus-4-7',
          provider: 'anthropic',
          inputTokens: 1000,
          outputTokens: 500,
          estimatedCostUsd: 0.018,
        }),
      ],
      { cacheHitRate: 0 },
    );
    // extra at Opus pricing (no cache): 15_000 * $5 / 1M = $0.075
    expect(result.counterfactualCostUsd - result.realCostUsd).toBeCloseTo(0.075);
  });

  it('subtracts cache writes from "fresh input" carry', () => {
    // Turn 1: 10k input total, but 4k cache-read + 4k cache-write 5m + 2k fresh.
    // Carry should be fresh(2k) + output(1k) = 3k, not 10k+1k.
    const result = counterfactualCost(
      [
        turn({
          agentId: 'a',
          at: '2026-05-01T00:00:00Z',
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          inputTokens: 10_000,
          outputTokens: 1000,
          cachedInputTokens: 4_000,
          cacheCreation5mTokens: 4_000,
          estimatedCostUsd: 0,
        }),
        turn({
          agentId: 'b',
          at: '2026-05-01T00:01:00Z',
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          inputTokens: 100,
          outputTokens: 50,
          estimatedCostUsd: 0,
        }),
      ],
      { cacheHitRate: 0 },
    );
    expect(result.extraInputTokensTotal).toBe(3_000);
  });

  it('per-turn report attributes extras to the receiving agent', () => {
    const result = counterfactualCost([
      turn({
        agentId: 'a',
        at: '2026-05-01T00:00:00Z',
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCostUsd: 0.01,
      }),
      turn({
        agentId: 'b',
        at: '2026-05-01T00:01:00Z',
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCostUsd: 0.01,
      }),
    ]);
    expect(result.perTurn).toHaveLength(2);
    expect(result.perTurn[0]!.agentId).toBe('a');
    expect(result.perTurn[0]!.extraCostUsd).toBe(0); // first turn, no carry
    expect(result.perTurn[1]!.agentId).toBe('b');
    expect(result.perTurn[1]!.extraCostUsd).toBeGreaterThan(0);
  });

  it('empty input → zero everything', () => {
    const result = counterfactualCost([]);
    expect(result.realCostUsd).toBe(0);
    expect(result.counterfactualCostUsd).toBe(0);
    expect(result.extraInputTokensTotal).toBe(0);
    expect(result.perTurn).toEqual([]);
  });
});
