import { describe, expect, it } from 'vitest';
import { CURSOR_AGENT_MODEL_IDS } from './agent-model-ids';
import { CURSOR_AUTO_MODEL, CURSOR_DEFAULT_MODEL, CURSOR_MODELS } from './models';
import { CURSOR_CHEAP_MODEL, CURSOR_PRICES } from './cost';

const accepted = new Set<string>(CURSOR_AGENT_MODEL_IDS);

describe('cursor model ids', () => {
  it('every registry model is a slug cursor-agent accepts', () => {
    const rejected = CURSOR_MODELS.map((m) => m.id).filter((id) => !accepted.has(id));
    expect(rejected).toEqual([]);
  });

  it('every priced model is a slug cursor-agent accepts', () => {
    const rejected = Object.keys(CURSOR_PRICES).filter((id) => !accepted.has(id));
    expect(rejected).toEqual([]);
  });

  it('the default, cheap and auto slugs are registered and accepted', () => {
    const registered = new Set(CURSOR_MODELS.map((m) => m.id));
    for (const id of [CURSOR_DEFAULT_MODEL, CURSOR_CHEAP_MODEL, CURSOR_AUTO_MODEL]) {
      expect(registered.has(id)).toBe(true);
      expect(accepted.has(id)).toBe(true);
    }
  });
});
