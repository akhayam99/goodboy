import type { ModelCostTier, ModelFamily, ModelTier, ProviderId } from './provider-registry';

export type EffortLevel = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type ModelKey = string;

export type ModelPresentation = {
  readonly family: ModelFamily;
  readonly group: string | null;
  readonly version: string;
  readonly order: number;
  readonly costTier: ModelCostTier;
};

export type BaseModel = {
  readonly key: ModelKey;
  readonly label: string;
  readonly tier: ModelTier;
  readonly presentation: ModelPresentation;
};

export type AnthropicModel = BaseModel & {
  readonly provider: 'anthropic';
  readonly cliId: string;
  readonly efforts: ReadonlyArray<EffortLevel>;
  readonly defaultEffort: EffortLevel;
};

export type CodexVariant = {
  readonly id: string;
  readonly label: string;
  readonly cliId: string;
};

export type CodexModel = BaseModel & {
  readonly provider: 'codex';
  readonly variants: ReadonlyArray<CodexVariant>;
  readonly efforts: ReadonlyArray<EffortLevel>;
  readonly defaultEffort: EffortLevel;
};

export type CursorCombo = {
  readonly effort: EffortLevel | null;
  readonly thinking: boolean;
  readonly fast: boolean;
  readonly slug: string;
  readonly maxMode: boolean;
};

export type CursorModel = BaseModel & {
  readonly provider: 'cursor';
  readonly combos: ReadonlyArray<CursorCombo>;
};

export type GeminiModel = BaseModel & {
  readonly provider: 'gemini';
  readonly cliId: string;
};

export type OpencodeModel = BaseModel & {
  readonly provider: 'opencode';
  readonly cliId: string;
  readonly efforts: ReadonlyArray<EffortLevel>;
  readonly defaultEffort: EffortLevel;
};

export type OpenRouterModel = BaseModel & {
  readonly provider: 'openrouter';
  readonly cliId: string;
  readonly efforts: ReadonlyArray<EffortLevel>;
  readonly defaultEffort: EffortLevel;
};

export type CatalogModel =
  | AnthropicModel
  | CodexModel
  | CursorModel
  | GeminiModel
  | OpencodeModel
  | OpenRouterModel;

export type ModelSelection = {
  readonly key: ModelKey;
  readonly effort?: EffortLevel;
  readonly variant?: string;
  readonly toggles?: {
    readonly thinking?: boolean;
    readonly fast?: boolean;
  };
};

export type EffortAxisLevel = {
  readonly level: EffortLevel;
  readonly available: boolean;
};

export type EffortAxis = {
  readonly label: string;
  readonly levels: ReadonlyArray<EffortAxisLevel>;
};

export type VariantAxisOption = {
  readonly id: string;
  readonly label: string;
};

export type VariantAxis = {
  readonly label: string;
  readonly options: ReadonlyArray<VariantAxisOption>;
  readonly activeId: string;
};

export type ToggleAxis = {
  readonly id: 'thinking' | 'fast';
  readonly label: string;
  readonly active: boolean;
  readonly canToggle: boolean;
};

export type ModelAxes = {
  readonly effort: EffortAxis | null;
  readonly variant: VariantAxis | null;
  readonly toggles: ReadonlyArray<ToggleAxis>;
  readonly requiresMaxMode: boolean;
};

export type ResolvedModelArgs = {
  readonly args: ReadonlyArray<string>;
  readonly clamped?: {
    readonly requested: EffortLevel;
    readonly applied: EffortLevel;
  };
};

export type ModelRemapRecord = {
  readonly sourceProvider: ProviderId;
  readonly targetProvider: ProviderId;
  readonly sourceKey: ModelKey;
  readonly targetKey: ModelKey;
  readonly reason: 'same-key' | 'tier-default';
  readonly clamped?: {
    readonly requested: EffortLevel;
    readonly applied: EffortLevel;
  };
};

export type RemappedModelSelection = {
  readonly selection: ModelSelection;
  readonly record: ModelRemapRecord;
};

export type StoredModelSelection = {
  readonly selection: ModelSelection;
  readonly report:
    | { readonly kind: 'legacy'; readonly id: string }
    | { readonly kind: 'unknown'; readonly id: string }
    | null;
};

export type ModelCatalogs = Readonly<Record<ProviderId, ReadonlyArray<CatalogModel>>>;
