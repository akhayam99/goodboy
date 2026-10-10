import { describe, expect, it, vi } from 'vitest';
import { HOSTILE_BUDGET_MS, loadHelpers, slowRuns, sweepHelper } from './test/hostileSweep';

describe('every exported parse, slug and sanitize helper stays under budget on hostile input', async () => {
  const helpers = await loadHelpers();

  it.each(helpers.map((helper) => [`${helper.file} ${helper.name}`, helper] as const))(
    '%s',
    async (_label, helper) => {
      const silence = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const runs = await sweepHelper({ helper }).finally(() => silence.mockRestore());
      expect(slowRuns({ runs, budgetMs: HOSTILE_BUDGET_MS })).toEqual([]);
    },
    60_000,
  );
});
