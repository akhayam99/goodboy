export { IllegalTurnTransitionError, turnReducer, type TurnLifecycleEvent } from './turn';

export {
  checkProviderBudget,
  checkSessionBudget,
  emitBudgetAlerts,
  getCurrentPeriodKey,
  getPeriodWindow,
  type AlertEmitterDeps,
} from './budget';

export {
  TelemetryRecorder,
  type RecordSummarizerInput,
  type RecordTurnInput,
  type TelemetryRecorderDeps,
} from './telemetry';

export {
  ContextEngine,
  InvalidSlotKeyError,
  SLOT_KEYS,
  SLOT_LABELS,
  assertSlotKey,
  assessPlanReadiness,
  autoPopulateContext,
  extractCommentResolved,
  extractFilesTouched,
  extractHandoff,
  extractMarkers,
  extractPlanFromMarker,
  isSlotKey,
  mergeIntoSlot,
  removeFromSlot,
  serializeSlots,
  type AutoPopulateInput,
  type AutoPopulateResult,
  type ContextEngineDeps,
  type ExtractedCommentResolution,
  type ExtractedHandoff,
  type ExtractedPlan,
  type PlanReadinessInput,
  type PlanReadinessResult,
  type SlotKey,
} from './context';

export {
  ROLE_DEFAULTS,
  defaultsForRole,
  isAgentRole,
  type AgentEffort,
  type AgentRole,
  type RoleDefaults,
} from './roles';

export { classifyFirstTurn, type AgentKindLabel } from './first-turn-classifier';

export { resolveProvider, type ResolveProviderInput } from './budget/router';

export { computeCostUsd, priceFor } from './providers/claude/cost';
export { parseStreamJsonLine, type ParseContext } from './providers/claude/parser';

// registry.ts (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from @goodboy/core/src/providers/registry when needed in Node context.
export {
  PROVIDER_CAPABILITIES,
  getCapabilities,
  getDefaultTurnModel,
} from './providers/capabilities';

export { assessTurnWeight, type TurnWeight } from './providers/turn-weight';

// CursorAdapter (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from @goodboy/core/src/providers/cursor/adapter when needed in Node context.
export { CURSOR_CHEAP_MODEL, computeCursorCostUsd } from './providers/cursor/cost';
export { CURSOR_DEFAULT_MODEL, CURSOR_MODELS } from './providers/cursor/models';
export {
  parseCursorStreamLine,
  type ParseContext as CursorParseContext,
} from './providers/cursor/parser';

export {
  SkillParseError,
  parseSkillMarkdown,
  parseSlashCommand,
  serializeSkillMarkdown,
  SkillRegistry,
  SkillRegistryError,
  type SkillFs,
  type SkillRegistryDeps,
  SkillExecutor,
  SkillScriptError,
  type SkillScriptRunner,
} from './skills';

// CodexAdapter (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from packages/core/src/providers/codex/adapter in Node contexts.
export { CODEX_CHEAP_MODEL, CODEX_DEFAULT_MODEL, CODEX_MODELS } from './providers/codex/constants';
export { computeCodexCostUsd, type CodexModelPriceOverride } from './providers/codex/cost';
export {
  parseJsonLine as parseCodexJsonLine,
  type ParseContext as CodexParseContext,
} from './providers/codex/parser';

// SummarizerCli (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from packages/core/src/summarizer/cli in Node/test contexts.
export {
  Summarizer,
  SummarizerParseError,
  SummarizerSpawnError,
  inferNextActions,
  type ContextSlotDelta,
  type ContextSlotDeltaUpsert,
  type InferNextActionsInput,
  type NextAction,
  type NextActionKind,
  type NextActionsPrState,
  type SummarizeInput,
  type SummarizerDeps,
  type SummarizerResult,
  type SummarizerUsage,
} from './summarizer';

export {
  buildStepPrompt,
  currentStep,
  findReusableAgent,
  isWorkflowComplete,
  nextStep,
  WorkflowPropagator,
  type WorkflowPropagatorDeps,
  WORKFLOW_LIBRARY,
  type WorkflowLibraryEntry,
  type WorkflowLibraryStep,
  seedWorkflowLibrary,
  type SeedResult,
  type SeedWorkflowLibraryDeps,
} from './workflows';
// WorkflowRegistry + seeder (@goodboy/db → node) are intentionally excluded from this
// browser-safe barrel. Import directly from packages/core/src/workflows/registry
// or packages/core/src/workflows/seeder in Node/Tauri command contexts.

export {
  PermissionEngine,
  type PermissionEngineDeps,
  parseToolPattern,
  parseArgsMatcher,
  formatToolPattern,
  type ToolMatcher,
  buildClaudeFlags,
  type ClaudeFlagSet,
  PermissionAuditRecorder,
  type AuditRecorderDeps,
  type AuditQuery,
} from './permissions';

export {
  fanOut,
  awaitMerge,
  onProgress,
  cancelGroup,
  detectConflicts,
  resolveConflicts,
  ManualResolutionRequiredError,
  type SchedulerDeps,
  type SchedulerHandle,
  type SchedulerProgress,
  type MergeResult,
  type UnsubscribeFn,
  type RunFileTouches,
  type FileConflict,
  type ResolvedConflict,
  type ConflictResolutionInput,
} from './scheduler';

export {
  createParallelWorktrees,
  removeParallelWorktrees,
  type ParallelWorktreeDeps,
  type ParallelWorktreeResult,
} from './worktree/parallel';

export { resolveSettings, type ResolveSettingsInput } from './settings/resolver';

export {
  DEFAULT_GH_TIMEOUT_MS,
  DEFAULT_PR_CACHE_TTL_MS,
  GhCliError,
  GhJsonParseError,
  detect as detectGh,
  detectRepoSlug,
  fetchLinkedIssues,
  fetchPrDetail,
  fetchPrDiff,
  getPrForBranch,
  invalidatePrCache,
  parseLinkedIssuesFromBody,
  parseUnifiedDiff,
  resolvePrForBranch,
  resolveReviewThread,
  runJson as ghRunJson,
  type GetPrInput,
  type GhDetectResult,
  type GhResult,
  type GhRunOptions,
  type GhRunner,
  type PrCacheDeps,
  type PrCacheStore,
  type ResolvedThread,
} from './github';

export {
  parsePlannerOutput,
  PlannerParseError,
  PLANNER_SYSTEM_PROMPT,
  buildPlannerUserPrompt,
  PlannerClient,
  PlannerClientSpawnError,
  type PlannerInput,
  type PlannerOutput,
  type PlannerStep,
  type PlannerClientDeps,
  type PlannerClientResult,
  type PlannerUsage,
} from './planner';
// PlannerAgent (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from packages/core/src/planner/cli in Node/Tauri command contexts.
