// Gated behind SUMMARIZER_INTEGRATION=1. Not run on CI by default.
// To enable: SUMMARIZER_INTEGRATION=1 pnpm test
// Why gated: avoids flaky CI when provider binary (claude, cursor-agent, codex) is unavailable or auth fails.
// Follows the gated pattern from packages/core/src/providers/cursor/adapter.integration.test.ts
import { describe, expect, it } from 'vitest';
import type { ContextSlot } from '@goodboy/types';
import { Summarizer } from './cli';

const enabled = process.env['SUMMARIZER_INTEGRATION'] === '1';

describe.skipIf(!enabled)('Summarizer, integration (requires active provider binary)', () => {
  it('detects available binary via anthropic provider', async () => {
    const summarizer = new Summarizer({ providerId: 'anthropic' });

    const result = await summarizer.summarize({
      prevSlots: [],
      turnInput: 'Write a simple function to add two numbers.',
      turnOutput: 'function add(a, b) { return a + b; }',
    });

    expect(result.delta).toBeDefined();
    expect(result.usage).toBeDefined();
    expect(result.model).toBeDefined();
  });

  it('returns valid usage with non-zero tokens from real provider CLI', async () => {
    const summarizer = new Summarizer({ providerId: 'anthropic' });

    const result = await summarizer.summarize({
      prevSlots: [{ key: 'goal', value: 'test', enabled: true }] as readonly ContextSlot[],
      turnInput: 'Refactor the auth module.',
      turnOutput: 'Updated auth module with JWT support.',
    });

    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(result.delta.upserts).toBeDefined();
  });

  it('parses non-empty delta from provider response', async () => {
    const summarizer = new Summarizer({ providerId: 'anthropic' });

    const result = await summarizer.summarize({
      prevSlots: [],
      turnInput: 'What are the main challenges?',
      turnOutput: 'Performance and scalability issues identified.',
    });

    expect(Array.isArray(result.delta.upserts)).toBe(true);
    expect(result.delta.upserts.length).toBeGreaterThan(0);
    result.delta.upserts.forEach((upsert) => {
      expect(typeof upsert.key).toBe('string');
      expect(typeof upsert.value).toBe('string');
      expect(upsert.value.length).toBeGreaterThan(0);
    });
  });
});
