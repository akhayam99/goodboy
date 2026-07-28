import type { ModelTier, ProviderId } from './provider-registry';

export type EffortLevel = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type ModelKey = string;

export type BaseModel = {
  readonly key: ModelKey;
  readonly label: string;
  readonly tier: ModelTier;
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
