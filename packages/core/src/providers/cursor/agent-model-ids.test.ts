import { describe, expect, it } from 'vitest';
import { CURSOR_AGENT_MODEL_IDS } from './agent-model-ids';
import { CURSOR_CATALOG } from './catalog';
import { CURSOR_AUTO_MODEL, CURSOR_DEFAULT_MODEL } from './models';
import { CURSOR_PRICES } from './cost';

const accepted = new Set<string>(CURSOR_AGENT_MODEL_IDS);
const emittable = new Set<string>(
  CURSOR_CATALOG.flatMap((model) => model.combos.map((combo) => combo.slug)),
);

describe('cursor model ids', () => {
  it('every slug the catalog can emit is one cursor-agent accepts', () => {
    const rejected = [...emittable].filter((slug) => !accepted.has(slug));
    expect(rejected).toEqual([]);
  });

  it('every priced model is a slug cursor-agent accepts', () => {
    const rejected = Object.keys(CURSOR_PRICES).filter((id) => !accepted.has(id));
    expect(rejected).toEqual([]);
    expect(Object.keys(CURSOR_PRICES).sort()).toEqual([
      'auto',
      'claude-4.6-sonnet-medium',
      'claude-4.6-sonnet-medium-thinking',
      'claude-fable-5-1-thinking-high',
      'claude-fable-5-1-thinking-low',
      'claude-fable-5-1-thinking-max',
      'claude-fable-5-1-thinking-medium',
      'claude-fable-5-1-thinking-xhigh',
      'claude-fable-5-thinking-high',
      'claude-fable-5-thinking-low',
      'claude-fable-5-thinking-max',
      'claude-fable-5-thinking-medium',
      'claude-fable-5-thinking-xhigh',
      'claude-opus-4-7-thinking-high',
      'claude-opus-4-8-thinking-high',
      'claude-opus-5-5-high',
      'claude-opus-5-5-low',
      'claude-opus-5-5-max',
      'claude-opus-5-5-medium',
      'claude-opus-5-5-xhigh',
      'claude-opus-5-low',
      'claude-opus-5-thinking-high',
      'claude-sonnet-5-high',
      'claude-sonnet-5-thinking-high',
      'claude-sonnet-5-thinking-xhigh',
      'claude-sonnet-5-xhigh',
      'composer-2.5',
      'composer-2.5-fast',
      'cursor-grok-4.6-medium',
      'cursor-grok-4.6-medium-fast',
      'gemini-3-flash',
      'gemini-3.1-pro',
      'gemini-3.5-flash',
      'gemini-3.6-flash-high',
      'gemini-3.6-flash-low',
      'gemini-3.6-flash-medium',
      'gemini-3.7-flash-high',
      'gemini-3.7-flash-low',
      'gemini-3.7-flash-medium',
      'gemini-3.8-flash-high',
      'gemini-3.8-flash-low',
      'gemini-3.8-flash-medium',
      'glm-5.2-high',
      'glm-5.2-max',
      'gpt-5.3-codex',
      'gpt-5.5-high',
      'gpt-5.5-medium',
      'gpt-5.6-luna-high',
      'gpt-5.6-luna-medium',
      'gpt-5.6-sol-high',
      'gpt-5.6-terra-high',
      'gpt-5.6-terra-xhigh',
      'grok-4.7-medium',
      'grok-4.7-medium-fast',
      'kimi-k2.7-code',
      'kimi-k3-high',
      'kimi-k3-low',
      'kimi-k3-max',
      'muse-spark-1.3-high',
      'muse-spark-1.3-low',
      'muse-spark-1.3-max',
      'muse-spark-1.3-medium',
      'muse-spark-1.3-xhigh',
    ]);
  });

  it('the default and auto slugs are emittable and accepted', () => {
    for (const slug of [CURSOR_DEFAULT_MODEL, CURSOR_AUTO_MODEL]) {
      expect(emittable.has(slug)).toBe(true);
      expect(accepted.has(slug)).toBe(true);
    }
  });
});
