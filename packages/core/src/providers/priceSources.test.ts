import { describe, expect, it } from 'vitest';
import { MODEL_CATALOGS } from './catalogs';
import { CLAUDE_PRICES } from './claude/cost';
import { CODEX_PRICES } from './codex/cost';
import { CURSOR_PRICES } from './cursor/cost';
import { GEMINI_PRICES } from './gemini/cost';

const GEMINI_FLASH_PROMO_ENDS = Date.parse('2027-01-01T00:00:00Z');

describe('one price table per provider', () => {
  it('prices every Claude model in the Claude cost table', () => {
    const missing = MODEL_CATALOGS.anthropic
      .filter((model) => CLAUDE_PRICES[model.cliId] == null)
      .map((model) => model.key);
    expect(missing).toEqual([]);
  });

  it('prices every Codex variant in the Codex cost table', () => {
    const missing = MODEL_CATALOGS.codex.flatMap((model) =>
      model.variants
        .filter((variant) => CODEX_PRICES[variant.cliId] == null)
        .map((variant) => variant.cliId),
    );
    expect(missing).toEqual([]);
  });

  it('prices every Gemini model in the Gemini cost table', () => {
    const missing = MODEL_CATALOGS.gemini
      .filter((model) => GEMINI_PRICES[model.cliId] == null)
      .map((model) => model.key);
    expect(missing).toEqual([]);
  });

  it('never lets a Cursor combo fall back to the most expensive rate', () => {
    const missing = MODEL_CATALOGS.cursor.flatMap((model) =>
      model.combos.filter((combo) => CURSOR_PRICES[combo.slug] == null).map((combo) => combo.slug),
    );
    expect(missing).toEqual([]);
  });

  it('turns red when the Gemini Flash launch rate ends, so the table moves to the new rate', () => {
    expect(
      Date.now() < GEMINI_FLASH_PROMO_ENDS,
      'Gemini Flash 3.6 to 3.8 move to 1.50 in and 7.50 out per Mtok on 2027-01-01: update gemini/cost.ts and docs/providers.md',
    ).toBe(true);
  });
});
