// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ASK_LIVE_BUDGET_TOKENS } from './ASK_LIVE_BUDGET_TOKENS';
import { ASK_STYLE_RULES, buildAskSystemPrompt } from './buildAskSystemPrompt';

const prompt = buildAskSystemPrompt({ sessionTitle: 'Stop retried webhooks', hasWorktrees: true });

describe('buildAskSystemPrompt', () => {
  it('carries every writing rule', () => {
    for (const rule of ASK_STYLE_RULES) {
      expect(prompt).toContain(rule);
    }
    expect(prompt).toContain('answer first');
    expect(prompt).toContain('No preamble, no restating the question, no closing offer');
    expect(prompt).toContain('language of the question');
    expect(prompt).toContain('Use a markdown table only when');
    expect(prompt).toContain('say what is unknown');
  });

  it('stays compact against the Ask budget', () => {
    expect(Math.ceil(prompt.length / 4)).toBeLessThan(ASK_LIVE_BUDGET_TOKENS / 4);
  });
});
