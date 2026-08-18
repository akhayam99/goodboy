import type {
  AnthropicModel,
  CatalogModel,
  CursorModel,
  EffortAxis,
  EffortLevel,
  ModelAxes,
  ModelSelection,
  ToggleAxis,
  VariantAxis,
} from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { ANTHROPIC_CATALOG } from './claude/catalog';
import { resolveCursorCombo } from './cursorCombo';
import { EFFORT_ORDER } from './effortOrder';

const CURSOR_EFFORT_ORDER = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] satisfies ReadonlyArray<EffortLevel>;

const ANTHROPIC_MODELS: ReadonlyArray<AnthropicModel> = ANTHROPIC_CATALOG;

const ANTHROPIC_EFFORT_ORDER: ReadonlyArray<EffortLevel> = EFFORT_ORDER.filter((level) =>
  ANTHROPIC_MODELS.some((candidate) => candidate.efforts.includes(level)),
);

type Params = {
  readonly model: CatalogModel;
  readonly selection: ModelSelection;
};

type EffortParams = {
  readonly label: string;
  readonly efforts: ReadonlyArray<EffortLevel>;
};

type SelectionAxesParams = {
  readonly model: CatalogModel;
};

type CursorParams = {
  readonly model: CursorModel;
  readonly selection: ModelSelection;
};

type CursorToggleParams = CursorParams & {
  readonly thinking: boolean;
  readonly fast: boolean;
};

const effortAxis = ({ label, efforts }: EffortParams): EffortAxis | null => {
  if (efforts.length === 0) {
    return null;
  }
  return {
    label,
    levels: efforts.map((level) => ({ level, available: true })),
  };
};

const selectionAxes = ({ model }: SelectionAxesParams) => {
  const catalog = [...MODEL_CATALOGS[model.provider]].sort(
    (left, right) => left.presentation.order - right.presentation.order,
  );
  const groupModels = new Map<string, CatalogModel>();
  for (const candidate of catalog) {
    const group = candidate.presentation.group ?? candidate.presentation.version;
    if (groupModels.has(group) === false) {
      groupModels.set(group, candidate);
    }
  }
  const activeGroup = model.presentation.group ?? model.presentation.version;
  return {
    model: {
      label: 'Model',
      options: [...groupModels.entries()].map(([label, candidate]) => ({
        id: label,
        label,
        modelKey: candidate.key,
      })),
      activeId: activeGroup,
    },
    version:
      model.presentation.group == null
        ? null
        : {
            label: 'Model Version',
            options: catalog
              .filter(
                (candidate) =>
                  (candidate.presentation.group ?? candidate.presentation.version) === activeGroup,
              )
              .map((candidate) => ({
                id: candidate.key,
                label: candidate.presentation.version,
                modelKey: candidate.key,
              })),
            activeId: model.key,
          },
  };
};

const cursorToggles = ({
  model,
  thinking,
  fast,
}: CursorToggleParams): ReadonlyArray<ToggleAxis> => {
  const toggles: Array<ToggleAxis> = [];
  const hasThinking = new Set(model.combos.map((combo) => combo.thinking)).size > 1;
  if (hasThinking) {
    toggles.push({
      id: 'thinking',
      label: 'Thinking',
      active: thinking,
      canToggle: model.combos.some((combo) => combo.thinking === !thinking && combo.fast === fast),
    });
  }
  const hasFast = new Set(model.combos.map((combo) => combo.fast)).size > 1;
  if (hasFast) {
    toggles.push({
      id: 'fast',
      label: 'Fast',
      active: fast,
      canToggle: model.combos.some((combo) => combo.thinking === thinking && combo.fast === !fast),
    });
  }
  return toggles;
};

const cursorAxes = ({ model, selection }: CursorParams): ModelAxes => {
  const thinking = selection.toggles?.thinking ?? model.combos[0]?.thinking ?? false;
  const fast = selection.toggles?.fast ?? model.combos[0]?.fast ?? false;
  const hasEffort = model.combos.some((combo) => combo.effort != null);
  const effort = hasEffort
    ? {
        label: 'Effort',
        levels: CURSOR_EFFORT_ORDER.map((level) => ({
          level,
          available: model.combos.some(
            (combo) => combo.thinking === thinking && combo.fast === fast && combo.effort === level,
          ),
        })),
      }
    : null;
  return {
    ...selectionAxes({ model }),
    effort,
    variant: null,
    toggles: cursorToggles({ model, selection, thinking, fast }),
    requiresMaxMode: resolveCursorCombo({ model, selection }).maxMode,
  };
};

type VariantParams = {
  readonly model: Extract<CatalogModel, { provider: 'codex' }>;
  readonly selection: ModelSelection;
};

const variantAxis = ({ model, selection }: VariantParams): VariantAxis | null => {
  if (model.variants.length <= 1) {
    return null;
  }
  const active =
    model.variants.find((variant) => variant.id === selection.variant) ?? model.variants[0];
  if (active == null) {
    return null;
  }
  return {
    label: 'Variant',
    options: model.variants.map((variant) => ({ id: variant.id, label: variant.label })),
    activeId: active.id,
  };
};

export const modelAxes = ({ model, selection }: Params): ModelAxes => {
  const selections = selectionAxes({ model });
  switch (model.provider) {
    case 'anthropic':
      return {
        ...selections,
        effort:
          model.efforts.length === 0
            ? null
            : {
                label: 'Effort',
                levels: ANTHROPIC_EFFORT_ORDER.map((level) => ({
                  level,
                  available: model.efforts.includes(level),
                })),
              },
        variant: null,
        toggles: [],
        requiresMaxMode: false,
      };
    case 'codex':
      return {
        ...selections,
        effort: effortAxis({ label: 'Effort', efforts: model.efforts }),
        variant: variantAxis({ model, selection }),
        toggles: [],
        requiresMaxMode: false,
      };
    case 'cursor':
      return cursorAxes({ model, selection });
    case 'gemini':
    case 'opencode':
    case 'openrouter':
    case 'moonshot':
      return {
        ...selections,
        effort: effortAxis({ label: 'Effort', efforts: model.efforts }),
        variant: null,
        toggles: [],
        requiresMaxMode: false,
      };
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown catalog model: ${String(exhaustive)}`);
    }
  }
};
