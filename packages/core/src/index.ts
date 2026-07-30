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
  ContextEngine,
  InvalidSlotKeyError,
  PREAMBLE_SLOT_TOTAL_BUDGET,
  SLOT_BUDGETS,
  SLOT_KEYS,
  SLOT_LABELS,
  assertSlotKey,
  assessPlanReadiness,
  autoPopulateContext,
  extractAllCommentAnalysis,
  extractAllCommentReplies,
  extractAllCommentResolved,
  extractAllCommentWontfix,
  extractClusterDone,
  extractClustersFromMarker,
  extractCommentAnalysis,
  extractCommentResolved,
  extractCommentWontfix,
  extractFilesTouched,
  extractHandoff,
  extractMarkers,
  extractPlanFromMarker,
  extractReviewComments,
  extractScoutDomains,
  extractScoutSplit,
  extractStepDone,
  isOpenQuestionAnswerText,
  isReviewThreadId,
  isSlotKey,
  addQuestionsToSlot,
  mergeIntoSlot,
  removeFromSlot,
  removeQuestionsFromSlot,
  serializeSlots,
  serializeSlotsBudgeted,
  stripControlMarkers,
  wrapOpenQuestionAnswers,
  type AutoPopulateInput,
  type AutoPopulateResult,
  type ContextEngineDeps,
  type ExtractedCluster,
  type ExtractedScoutArea,
  type ExtractedCommentAnalysis,
  type ExtractedCommentReply,
  type ExtractedCommentResolution,
  type ExtractedCommentWontfix,
  type ExtractedHandoff,
  type ExtractedPlan,
  type ExtractedReviewComment,
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
export { getModelPrice, type ModelPriceSummary } from './providers/model-price';
export { parseStreamJsonLine, type ParseContext } from './providers/claude/parser';

export {
  PROVIDER_CAPABILITIES,
  getCapabilities,
  getDefaultTurnModel,
} from './providers/capabilities';

export {
  autoModelForRole,
  recommendedModelForRole,
  type AutoModelChoice,
} from './providers/auto-model';

export { resolveModelForProvider } from './providers/model-map';
export { MODEL_CATALOGS } from './providers/catalogs';
export { ANTHROPIC_CATALOG } from './providers/claude/catalog';
export { CODEX_CATALOG } from './providers/codex/catalog';
export { CURSOR_CATALOG } from './providers/cursor/catalog';
export { GEMINI_CATALOG } from './providers/gemini/catalog';
export { OPENCODE_CATALOG } from './providers/opencode/catalog';
export { OPENROUTER_CATALOG } from './providers/openrouter/catalog';
export { defaultModelSelection } from './providers/defaultModelSelection';
export { modelIdForSelection } from './providers/modelIdForSelection';
export { parseLegacyId } from './providers/parseLegacyId';
export { remapModelSelection } from './providers/remapModelSelection';
export { resolveCursorCombo } from './providers/cursorCombo';
export { modelAxes } from './providers/modelAxes';
export { resolveModelArgs } from './providers/resolveModelArgs';
export { resolveStoredModelSelection } from './providers/resolveStoredModelSelection';
export { selectionRequiresMaxMode } from './providers/selectionRequiresMaxMode';
export type {
  EffortAxis,
  EffortAxisLevel,
  ModelAxes,
  ModelPresentation,
  ToggleAxis,
  VariantAxis,
  VariantAxisOption,
} from '@goodboy/types';

export { resolveTaskModel } from './providers/task-models';

export { resolveRoleRouting, type ResolvedRoleRouting } from './providers/role-models';

export { getCheapModel, getDefaultBinary } from './providers/cli-defaults';
export { cliModelId } from './providers/cliModelId';
export { extractAuxOutput, type AuxOutput, type AuxUsage } from './providers/aux-output';
export { runAuxOneShot, type AuxSpawnResult } from './providers/aux-spawn';

export { getModelDescriptor, getModelProvider } from './providers/model-display';
export { computeProviderCostUsd } from './providers/provider-cost';
export { contextTokensForUsage } from './providers/context-tokens';

export { assessTurnWeight, type TurnWeight } from './providers/turn-weight';

export { computeCursorCostUsd } from './providers/cursor/cost';
export { CURSOR_AUTO_MODEL, CURSOR_DEFAULT_MODEL, CURSOR_MODELS } from './providers/cursor/models';
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

export { CODEX_CHEAP_MODEL, CODEX_DEFAULT_MODEL, CODEX_MODELS } from './providers/codex/constants';
export { computeCodexCostUsd, type CodexModelPriceOverride } from './providers/codex/cost';
export {
  parseJsonLine as parseCodexJsonLine,
  type ParseContext as CodexParseContext,
} from './providers/codex/parser';

export { OPENCODE_MODELS } from './providers/opencode/constants';
export { OPENROUTER_MODELS } from './providers/openrouter/constants';
export { computeOpenCodeCostUsd } from './providers/opencode/cost';
export {
  parseJsonLine as parseOpenCodeJsonLine,
  type ParseContext as OpenCodeParseContext,
} from './providers/opencode/parser';

export {
  GEMINI_CHEAP_MODEL,
  GEMINI_DEFAULT_MODEL,
  GEMINI_MODELS,
} from './providers/gemini/constants';
export { computeGeminiCostUsd, type GeminiModelPriceOverride } from './providers/gemini/cost';
export {
  parseJsonLine as parseGeminiJsonLine,
  type ParseContext as GeminiParseContext,
} from './providers/gemini/parser';

export {
  Summarizer,
  SummarizerCliError,
  SummarizerParseError,
  SummarizerSpawnError,
  fallbackStepOutputSummary,
  isFallbackStepOutputSummary,
  rewriteWorkflowGoal,
  summarizeStepOutput,
  buildGoalRewriteUserPrompt,
  type ContextSlotDelta,
  type ContextSlotDeltaUpsert,
  type GoalRewriteDeps,
  type GoalRewriteInput,
  type SummarizeInput,
  type SummarizerDeps,
  type SummarizerResult,
  type SummarizerUsage,
} from './summarizer';

export {
  buildChainCarryForward,
  buildParallelCarryForward,
  buildStepPrompt,
  classifyWorkflowChain,
  currentStep,
  findReusableAgent,
  isWorkflowComplete,
  nextStep,
  runsForWorkflowRun,
  type ChainCarryForwardStep,
  type ParallelCarryForwardBranch,
  type WorkflowChainState,
  WORKFLOW_LIBRARY,
  type WorkflowLibraryEntry,
  type WorkflowLibraryStep,
  seedWorkflowLibrary,
  type SeedResult,
  type SeedWorkflowLibraryDeps,
  formatWorkflowFromNL,
  buildWorkflowFormatUserPrompt,
  parseFormattedWorkflow,
  type FormattedWorkflow,
  type FormattedWorkflowStep,
  type WorkflowFormatInput,
  type WorkflowFormatDeps,
  polishWorkflowGoal,
  parsePolishedGoal,
  type GoalPolishDeps,
  polishStepInstruction,
  parsePolishedStep,
  type StepPolishDeps,
  type StepPolishInput,
} from './workflows';

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
  listAssignedIssues,
  listOpenPrsForRepo,
  listOwnedRepos,
  listPrsForBranch,
  addPullRequestReview,
  addReviewThreadReply,
  fetchPrNodeId,
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
  type GithubRepoRef,
  type OwnedReposResult,
  type PostedPullRequestReview,
  type PostedThreadReply,
  type PrCacheDeps,
  type PrCacheStore,
  type RepoPullRequest,
  type ResolvedThread,
  type ReviewEvent,
  type ReviewThreadDraft,
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
