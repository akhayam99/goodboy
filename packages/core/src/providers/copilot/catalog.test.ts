import { describe, expect, it } from 'vitest';
import { COPILOT_CATALOG } from './catalog';
import { COPILOT_AGENT_MODEL_IDS } from './agent-model-ids';
import { MODEL_CATALOGS } from '../catalogs';
import { cliModelId } from '../cliModelId';
import { defaultModelSelection } from '../defaultModelSelection';
import { getCheapModel } from '../cli-defaults';
import { resolveModelArgs } from '../resolveModelArgs';
import { strongestModelForTier } from '../strongestModelForTier';

describe('COPILOT_CATALOG', () => {
  it('lists auto and the models the cli reference names, and nothing else', () => {
    expect(COPILOT_CATALOG.map((model) => model.cliId).sort()).toEqual(
      [
        'auto',
        'claude-haiku-4.5',
        'claude-haiku-5.5',
        'claude-opus-5.5',
        'claude-sonnet-5.5',
        'gemini-3.8-flash',
        'gemini-4-hydrogen',
        'gpt-5.3-codex',
        'gpt-6-astra',
        'gpt-6-luna',
        'gpt-6.1-sol',
        'gpt-6.1-terra',
        'gpt-6.2-astra',
        'gpt-6.2-sol',
      ].sort(),
    );
  });

  it('places GPT-6.1 Sol on the mid cost tier, as Codex does at the same price', () => {
    const tierOf = new Map(
      COPILOT_CATALOG.map((model) => [model.key, model.presentation.costTier]),
    );
    expect(tierOf.get('gpt-6.1-sol')).toBe('mid');
    expect(tierOf.get('gpt-6.2-sol')).toBe('mid');
    expect(tierOf.get('gpt-6.2-astra')).toBe('expensive');
  });

  it('takes Terra, which Copilot Pro includes, as the mid tier pick, and Codex keeps Sol', () => {
    const pick = { tier: 'mid', wantsThinker: false } as const;

    expect(strongestModelForTier({ provider: 'copilot', ...pick })?.id).toBe('gpt-6.1-terra');
    expect(strongestModelForTier({ provider: 'codex', ...pick })?.id).toBe('gpt-6.1-sol');
  });

  it('defaults to auto and has exactly one default', () => {
    expect(COPILOT_CATALOG.filter((model) => model.defaultTurn === true)).toHaveLength(1);
    expect(defaultModelSelection({ provider: 'copilot' })).toEqual({
      key: 'auto',
      effort: 'medium',
    });
  });

  it('sends the cli id and the reasoning effort flag', () => {
    expect(cliModelId({ provider: 'copilot', model: 'sonnet-5.5' })).toBe('claude-sonnet-5.5');
    expect(
      resolveModelArgs({ provider: 'copilot', selection: { key: 'sonnet-5.5', effort: 'high' } }),
    ).toEqual({ args: ['--model', 'claude-sonnet-5.5', '--reasoning-effort', 'high'] });
  });

  it('sends no effort for a model with no reasoning levels', () => {
    for (const key of ['auto', 'haiku-4.5', 'gemini-3.8-flash', 'gemini-4-hydrogen']) {
      expect(resolveModelArgs({ provider: 'copilot', selection: { key } }).args).toHaveLength(2);
    }
  });

  it('only offers the three effort levels every documented reasoning model shares', () => {
    for (const model of COPILOT_CATALOG) {
      expect(model.efforts.length === 0 || model.efforts.join() === 'low,medium,high').toBe(true);
    }
  });

  it('picks the newest cheap model for side jobs', () => {
    expect(getCheapModel('copilot')).toBe('haiku-5.5');
  });

  it('keeps every cli id in the accepted id list', () => {
    expect([...COPILOT_AGENT_MODEL_IDS].sort()).toEqual(
      MODEL_CATALOGS.copilot.map((model) => model.cliId).sort(),
    );
  });
});
