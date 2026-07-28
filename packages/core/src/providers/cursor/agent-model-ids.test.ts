import { describe, expect, it } from 'vitest';
import { CURSOR_AGENT_MODEL_IDS } from './agent-model-ids';
import { CURSOR_CATALOG } from './catalog';
import { CURSOR_AUTO_MODEL, CURSOR_DEFAULT_MODEL } from './models';
import { CURSOR_CHEAP_MODEL, CURSOR_PRICES } from './cost';

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
  });

  it('the default, cheap and auto slugs are emittable and accepted', () => {
    for (const slug of [CURSOR_DEFAULT_MODEL, CURSOR_CHEAP_MODEL, CURSOR_AUTO_MODEL]) {
      expect(emittable.has(slug)).toBe(true);
      expect(accepted.has(slug)).toBe(true);
    }
  });
});
