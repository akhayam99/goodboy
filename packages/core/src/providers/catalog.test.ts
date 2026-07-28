import { describe, expect, it } from 'vitest';
import type {
  CatalogModel,
  EffortLevel,
  ModelFamily,
  ModelSelection,
  ProviderId,
} from '@goodboy/types';
import { PROVIDER_IDS } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { MODEL_CATALOGS } from './catalogs';
import { ANTHROPIC_AGENT_MODEL_IDS } from './claude/agent-model-ids';
import { CODEX_AGENT_MODEL_IDS } from './codex/agent-model-ids';
import { CURSOR_AGENT_MODEL_IDS } from './cursor/agent-model-ids';
import { GEMINI_AGENT_MODEL_IDS } from './gemini/agent-model-ids';
import { OPENCODE_AGENT_MODEL_IDS } from './opencode/agent-model-ids';
import { OPENROUTER_AGENT_MODEL_IDS } from './openrouter/agent-model-ids';
import { resolveModelArgs } from './resolveModelArgs';

const ACCEPTED_IDS = {
  anthropic: ANTHROPIC_AGENT_MODEL_IDS,
  cursor: CURSOR_AGENT_MODEL_IDS,
  codex: CODEX_AGENT_MODEL_IDS,
  gemini: GEMINI_AGENT_MODEL_IDS,
  opencode: OPENCODE_AGENT_MODEL_IDS,
  openrouter: OPENROUTER_AGENT_MODEL_IDS,
} satisfies Readonly<Record<ProviderId, ReadonlyArray<string>>>;

type AssertParams = {
  readonly provider: ProviderId;
  readonly selection: ModelSelection;
};

const emittedModel = ({ provider, selection }: AssertParams): string => {
  const args = resolveModelArgs({ provider, selection }).args;
  const flag = provider === 'anthropic' || provider === 'cursor' ? '--model' : '-m';
  const index = args.indexOf(flag);
  const id = args[index + 1];
  if (id == null) {
    throw new Error(`missing model argument for ${provider}`);
  }
  return id;
};

type CrossParams = {
  readonly provider: ProviderId;
  readonly model: CatalogModel;
};

const selectionsFor = ({ model }: CrossParams): ReadonlyArray<ModelSelection> => {
  switch (model.provider) {
    case 'anthropic':
      return model.efforts.length > 0
        ? model.efforts.map((effort) => ({ key: model.key, effort }))
        : [{ key: model.key }];
    case 'codex':
      return model.variants.flatMap((variant) =>
        model.efforts.map((effort) => ({ key: model.key, effort, variant: variant.id })),
      );
    case 'cursor':
      return model.combos.map((combo) => ({
        key: model.key,
        ...(combo.effort != null && { effort: combo.effort }),
        toggles: { thinking: combo.thinking, fast: combo.fast },
      }));
    case 'gemini':
      return [{ key: model.key }];
    case 'opencode':
    case 'openrouter':
      return model.efforts.map((effort) => ({ key: model.key, effort }));
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown model: ${exhaustive}`);
    }
  }
};

describe('model catalogs', () => {
  it('only emits ids accepted by each provider fixture', () => {
    for (const provider of PROVIDER_IDS) {
      for (const model of MODEL_CATALOGS[provider]) {
        for (const selection of selectionsFor({ provider, model })) {
          expect(ACCEPTED_IDS[provider]).toContain(emittedModel({ provider, selection }));
        }
      }
    }
  });

  it('enforces structural invariants and picker reachability', () => {
    const efforts = new Set<EffortLevel>(['minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
    const cursorSlugs = new Set<string>();
    for (const provider of PROVIDER_IDS) {
      const catalog = MODEL_CATALOGS[provider];
      expect(new Set(catalog.map((model) => model.key)).size).toBe(catalog.length);
      expect(PROVIDER_CAPABILITIES[provider].models.map((model) => model.id)).toEqual(
        catalog.map((model) => model.key),
      );
      for (const model of catalog) {
        if (model.provider === 'codex') {
          expect(model.variants.length).toBeGreaterThan(0);
        }
        if (model.provider === 'cursor') {
          for (const combo of model.combos) {
            expect(combo.effort === null || efforts.has(combo.effort)).toBe(true);
            expect(cursorSlugs.has(combo.slug)).toBe(false);
            cursorSlugs.add(combo.slug);
          }
        }
      }
    }
  });

  it('keeps presentation order unique and grouped models in one family per provider', () => {
    for (const provider of PROVIDER_IDS) {
      const catalog = MODEL_CATALOGS[provider];
      expect(new Set(catalog.map((model) => model.presentation.order)).size).toBe(catalog.length);
      const familyByGroup = new Map<string, ModelFamily>();
      for (const model of catalog) {
        const group = model.presentation.group;
        if (group == null) {
          continue;
        }
        const family = familyByGroup.get(group);
        if (family != null) {
          expect(model.presentation.family).toBe(family);
          continue;
        }
        familyByGroup.set(group, model.presentation.family);
      }
    }
  });

  it('pins the cursor combos that require Max Mode', () => {
    const maxModeSlugs: Array<string> = [];
    for (const model of MODEL_CATALOGS.cursor) {
      for (const combo of model.combos) {
        if (combo.maxMode) {
          maxModeSlugs.push(combo.slug);
        }
      }
    }
    maxModeSlugs.sort();
    expect(maxModeSlugs).toEqual([
      'claude-opus-4-7-thinking-high',
      'claude-opus-5-low',
      'claude-opus-5-thinking-high',
      'gpt-5.5-high',
      'gpt-5.5-medium',
      'gpt-5.6-sol-high',
    ]);
  });

  it('clamps to the nearest lower effort and reports the change', () => {
    expect(
      resolveModelArgs({
        provider: 'anthropic',
        selection: { key: 'sonnet-4.6', effort: 'max' },
      }),
    ).toEqual({
      args: ['--model', 'claude-sonnet-4-6', '--effort', 'high'],
      clamped: { requested: 'max', applied: 'high' },
    });
  });

  it('keeps a bare Codex family id unrepresentable', () => {
    const emitted = codexCatalogIds({});
    expect(emitted).not.toContain('gpt-5.6');
    expect(emitted).toEqual(CODEX_AGENT_MODEL_IDS);
  });

  it('throws when a provider cannot recognize a model key', () => {
    expect(() =>
      resolveModelArgs({
        provider: 'codex',
        selection: { key: 'gpt-99', effort: 'high' },
      }),
    ).toThrow('unknown model key for codex: gpt-99');
  });
});

type CatalogIdsParams = Record<string, never>;

const codexCatalogIds = ({}: CatalogIdsParams): ReadonlyArray<string> => {
  return MODEL_CATALOGS.codex.flatMap((model) => {
    if (model.provider !== 'codex') {
      return [];
    }
    return model.variants.map((variant) => variant.cliId);
  });
};
