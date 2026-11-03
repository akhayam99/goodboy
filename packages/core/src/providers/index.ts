export { computeCostUsd, priceFor } from './claude/cost';

export { getProviderModelPrice } from './model-price';

export {
  OPENCODE_ROUTING,
  PROVIDER_KIND,
  isApiProvider,
  opencodeModelArg,
} from './provider-catalog';

export { PROVIDER_LIFECYCLE_COMMANDS, canLogout } from './provider-commands';

export { cleanCliVersion, isCliVersionBelow, newestCliVersion } from './cliVersion';

export {
  cliGate,
  cliSupportedSibling,
  outdatedCliModels,
  type CliGate,
  type CliRequirement,
} from './cliGate';

export { PROVIDER_CONNECT_CAPABILITIES } from './provider-connect';

export { DEFAULT_SESSION_PROVIDER_PREFERENCE } from './provider-preference';

export { CLI_CREDENTIAL } from './provider-credential';

export { PROVIDER_API_KEY_ENV } from './provider-api-key-env';

export { parseStreamJsonLine, type ParseContext } from './claude/parser';

export { parseCodexRateLimits } from './limits/parseCodexRateLimits';

export {
  parseCodexAppServerLimits,
  parseCodexResetCredits,
} from './limits/parseCodexAppServerLimits';

export {
  parseResetOutcome,
  resetAdvice,
  type ResetAdvice,
  type ResetOutcome,
} from './limits/resetAdvice';

export {
  claudeUsageResultTextOf,
  parseClaudeUsageProbeOutput,
  parseClaudeUsageText,
} from './limits/parseClaudeUsageText';

export { mergeProviderLimits } from './limits/mergeProviderLimits';

export { sortLimitWindows } from './limits/sortLimitWindows';

export { LIMITS_STALE_MS, LIMITS_WARNING_FRACTION } from './limits/constants';

export {
  PROVIDERS_REPORTING_LIMITS,
  limitsChipOf,
  selectLimitsChips,
  worstLimitsChip,
  type LimitsChip,
  type LimitsChipState,
} from './limits/selectLimitsChips';

export { providersAtLimit } from './limits/providersAtLimit';

export { PROVIDER_CAPABILITIES, getCapabilities, getDefaultTurnModel } from './capabilities';

export {
  PROVIDER_FLAGS,
  providerFlags,
  providersOnSameBinary,
  type ProviderFlags,
  type ProviderStatusSlot,
} from './providerFlags';

export { autoModelForRole, recommendedModelForRole, type AutoModelChoice } from './auto-model';

export { resolveModelForProvider } from './model-map';

export { resolveModelIdForProvider } from './resolveModelIdForProvider';

export { canonicalModelId } from './canonicalModelId';

export { modelCatalogKey } from './modelCatalogKey';

export { MODEL_CATALOGS } from './catalogs';

export { catalogModelForId } from './catalogModelForId';

export { ANTHROPIC_CATALOG } from './claude/catalog';

export { CODEX_CATALOG } from './codex/catalog';

export { CURSOR_CATALOG } from './cursor/catalog';

export { OPENCODE_CATALOG } from './opencode/catalog';

export { OPENROUTER_CATALOG } from './openrouter/catalog';

export { defaultModelSelection } from './defaultModelSelection';

export { modelIdForSelection } from './modelIdForSelection';

export { parseLegacyId } from './parseLegacyId';

export { remapModelSelection } from './remapModelSelection';

export { resolveCursorCombo } from './cursorCombo';

export { modelAxes } from './modelAxes';

export {
  isModelHidden,
  legacyHiddenModels,
  parseHiddenModels,
  selectableModels,
  visibleCatalog,
  visibleModelCount,
  withModelsVisible,
  type HiddenModels,
} from './modelVisibility';

export { modelHasEffortAxis } from './modelHasEffortAxis';

export { clampEffortForModel, modelEffortLevels } from './clampEffortForModel';

export { resolveModelArgs } from './resolveModelArgs';

export { PROVIDER_ARG_FLAGS, extractSpawnModel, type ProviderArgFlags } from './providerArgFlags';

export { resolveStoredModelSelection } from './resolveStoredModelSelection';

export { resolvedStoredModelId } from './resolvedStoredModelId';

export { selectionRequiresMaxMode } from './selectionRequiresMaxMode';

export { resolveTaskModel } from './task-models';

export {
  nextRoleModelChoice,
  resolveRoleChoice,
  resolveRoleRouting,
  roleModelChoices,
  roleModelSetPreference,
  type PinnedUnavailable,
  type ResolvedRoleChoice,
  type ResolvedRoleRouting,
} from './role-models';

export {
  resolveAuto,
  type AutoContext,
  type AutoPick,
  type AutoSlot,
  type AutoStep,
} from './autoRouting/resolveAuto';

export {
  enabledProvidersOf,
  firstOnProvider,
  providerCandidates,
  providerStanding,
  seedProviderPolicy,
  workingProviders,
  type ProviderCandidatesContext,
  type ProviderStanding,
} from './autoRouting/providerCandidates';

export {
  PROVIDER_HEADROOM_STALE_MS,
  providerHeadroom,
  providersByHeadroom,
  readHeadroom,
  type HeadroomMap,
  type HeadroomReading,
  type ProviderHeadroom,
} from './limits/providerHeadroom';

export { AUTO_DEFAULTS, isCuratedProvider, type CuratedProviderId } from './autoRouting/defaults';

export { isSizeMovingRung } from './autoRouting/slotRungs';

export { workflowModelProfile } from './workflowModelProfiles';

export { latestInGroup, type ModelLine } from './latestInGroup';

export { getCheapModel, getDefaultBinary } from './cli-defaults';

export { planTurnFallback, type TurnFailureKind, type TurnFallbackPlan } from './planTurnFallback';

export { fallbackWantsThinker } from './fallbackWantsThinker';

export { strongestModelForTier } from './strongestModelForTier';

export { planAlternateTaskModel, planTaskModelFallback } from './task-model-fallback';

export {
  runWithModelFallback,
  type BackgroundAttempt,
  type BackgroundPool,
  type BackgroundResult,
} from './background-retry';

export { cliModelId } from './cliModelId';

export {
  createJsonLineAssembler,
  type JsonLineAssembler,
  type JsonLineAssemblerResult,
} from './shared/createJsonLineAssembler';

export { extractAuxOutput, type AuxOutput, type AuxUsage } from './aux-output';

export { runAuxOneShot, type AuxSpawnResult } from './aux-spawn';

export { AuxTimedOutError } from './auxTimedOut';

export { getModelDescriptor, getModelProvider } from './model-display';

export { computeProviderCostUsd } from './provider-cost';

export { contextTokensForUsage, inputTokensForUsage } from './context-tokens';

export { assessTurnWeight, type TurnWeight } from './turn-weight';

export { costCoverage, type CostCoverage } from './cost-coverage';

export { computeCursorCostUsd } from './cursor/cost';

export { CURSOR_AUTO_MODEL, CURSOR_MODELS } from './cursor/models';

export { parseCursorStreamLine } from './cursor/parser';

export { computeCodexCostUsd } from './codex/cost';

export { parseJsonLine as parseCodexJsonLine } from './codex/parser';

export { OPENROUTER_MODELS } from './openrouter/constants';

export { computeOpenCodeCostUsd } from './opencode/cost';

export { parseJsonLine as parseOpenCodeJsonLine } from './opencode/parser';

export { parseJsonLine as parseCopilotJsonLine } from './copilot/parser';

export { computeGeminiCostUsd } from './gemini/cost';

export { parseJsonLine as parseGeminiJsonLine } from './gemini/parser';

export {
  explainResolution,
  skippedPinNote,
  mergeLayers,
  resolveSlot,
  type LayerName,
  type MergedLayers,
  type Resolution,
  type ResolveContext,
  type ResolveLayer,
  type ResolveLayers,
  type ResolveNames,
  type ResolvePin,
  type ResolvePins,
  type ResolveSkip,
  type ResolveSlot,
  type ResolveSource,
  type ResolveVia,
  type SkipReason,
} from './resolve';
