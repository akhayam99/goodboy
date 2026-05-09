export { IllegalTurnTransitionError, turnReducer, type TurnLifecycleEvent } from './turn';

export {
  checkProviderBudget,
  checkTaskBudget,
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
  isSlotKey,
  serializeSlots,
  type ContextEngineDeps,
  type SlotKey,
} from './context';

export { resolveProvider, type ResolveProviderInput } from './budget/router';

export { computeCostUsd, priceFor } from './providers/claude/cost';
export { parseStreamJsonLine, type ParseContext } from './providers/claude/parser';

// registry.ts (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from @kay-am/core/src/providers/registry when needed in Node context.
export {
  PROVIDER_CAPABILITIES,
  getCapabilities,
  getDefaultTurnModel,
} from './providers/capabilities';

// CursorAdapter (node:child_process) is intentionally excluded from this browser-safe barrel.
// Import directly from @kay-am/core/src/providers/cursor/adapter when needed in Node context.
export { CURSOR_CHEAP_MODEL, computeCursorCostUsd } from './providers/cursor/cost';
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
export { CODEX_CHEAP_MODEL } from './providers/codex/constants';
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
  type ContextSlotDelta,
  type ContextSlotDeltaUpsert,
  type SummarizeInput,
  type SummarizerDeps,
  type SummarizerResult,
  type SummarizerUsage,
} from './summarizer';

export {
  buildStepPrompt,
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
// WorkflowRegistry + seeder (@kay-am/db → node) are intentionally excluded from this
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
