export {
  availableBranchName,
  BRANCH_PLACEHOLDERS,
  branchNameProblem,
  branchTemplateProblem,
  buildBranchName,
  DEFAULT_BRANCH_TEMPLATE,
  isValidBranchName,
  MAX_BRANCH_NAME_LENGTH,
  MAX_SLUG_LENGTH,
  NO_TASK_BRANCH_TEMPLATE,
  nextFreeBranchName,
  nextAvailableSlug,
  slugify,
  trimSlugAtWord,
  unknownBranchPlaceholders,
  withSlugSuffix,
  type BranchNameProblem,
  type BranchPlaceholder,
  type BranchTemplateProblem,
  type BranchValues,
} from './slug';
export { sha256Hex } from './slug/sha256';
export { untrustedBlock } from './untrustedBlock';
export { IllegalTurnTransitionError, turnReducer, type TurnLifecycleEvent } from './turn';

export {
  findSecretMatches,
  scanTextForSecrets,
  type SecretFinding,
  type SecretMatch,
} from './secret-scan';

export {
  ContextEngine,
  InvalidSlotKeyError,
  PREAMBLE_SLOT_TOTAL_BUDGET,
  SLOT_BUDGETS,
  SLOT_KEYS,
  SLOT_LABELS,
  assertSlotKey,
  appendDecision,
  assessPlanReadiness,
  autoPopulateContext,
  extractAllCommentAnalysis,
  extractAllCommentNeedsInput,
  extractAllCommentReplies,
  extractAllCommentResolved,
  extractAllCommentWontfix,
  extractHistoryReport,
  extractScribeText,
  extractClusterDone,
  extractClustersFromMarker,
  extractCommentAnalysis,
  extractCommentResolved,
  extractCommentVerdict,
  extractCommentWontfix,
  extractFanOut,
  extractFilesTouched,
  extractHandoff,
  extractMarkers,
  extractMaterializeRequests,
  extractPlanFromMarker,
  extractReviewComments,
  extractScoutDomains,
  extractScoutSplit,
  extractOpenQuestionAnswer,
  extractProseQuestion,
  extractStepDone,
  hasBlockingQuestion,
  isOpenQuestionAnswerText,
  isReviewThreadId,
  isSlotKey,
  addQuestionsToSlot,
  activeDecisionsNewestFirst,
  applyDecisionOps,
  applyDecisionOpsToSession,
  CONSOLIDATION_OP_KINDS,
  countDecisionChanges,
  extractDecisionOps,
  hasVisibleDecisionChange,
  isLedgerOverBudget,
  loadDecisionLedger,
  normalizeDecisionText,
  reconcileDecisionsText,
  renderDecisionsSlot,
  seedDecisionLedger,
  type AppliedDecisionOps,
  type ApplyDecisionOpsResult,
  type DecisionActor,
  type DecisionChange,
  type DecisionChangeCounts,
  type DecisionOp,
  type DecisionRejection,
  type DecisionRejectionReason,
  type ExtractedDecisionOp,
  insertSummarySection,
  mergeIntoSlot,
  parseDecisions,
  parseSummaryDocument,
  removeDecision,
  removeFromSlot,
  removeQuestionsFromSlot,
  removeSessionQuestionsFromSlots,
  replaceDecision,
  replaceSummarySectionBody,
  serializeDecisions,
  serializeSlots,
  serializeSlotsBudgeted,
  serializeSummaryDocument,
  stripControlMarkers,
  SUMMARY_SECTION_KEYS,
  SUMMARY_SECTION_TITLES,
  wrapOpenQuestionAnswers,
  type AutoPopulateInput,
  type AutoPopulateResult,
  type ContextEngineDeps,
  type DecisionRow,
  type DecisionsDocument,
  type ExtractedCluster,
  type ExtractedFanOutArea,
  type ExtractedScoutArea,
  type ExtractedCommentAnalysis,
  type ExtractedCommentReply,
  type ExtractedCommentResolution,
  type ExtractedCommentVerdict,
  type CommentVerdictKind,
  type ExtractedCommentWontfix,
  type ExtractedHistoryReport,
  type ExtractedScribeText,
  type ExtractedHandoff,
  type ExtractedMaterializeRequest,
  type ExtractedPlan,
  type ExtractedReviewComment,
  type PlanReadinessInput,
  type PlanReadinessResult,
  type SlotKey,
  type SummaryBlock,
  type SummaryDocument,
  type SummarySectionKey,
} from './context';

export {
  AUTO_AUX_RESERVATION_USD,
  AUTO_BATCH_MAX_CHILDREN,
  AUTO_BATCH_MIN_CHILDREN,
  AUTO_BRIEF_VERSION,
  AUTO_CHILD_IDLE_MINUTES,
  AUTO_DELEGATION_DEADLINE_MINUTES,
  AUTO_DELIVERY_ARTIFACT_CHARS,
  AUTO_STALE_DECIDE_MS,
  AUTO_FACTS_CHARS,
  AUTO_FACTS_CHECKS_MAX,
  AUTO_FACTS_COMMITS_MAX,
  AUTO_FACTS_FETCH_MS,
  AUTO_FACTS_MOUNTS_MAX,
  AUTO_FACTS_THREAD_CHARS,
  AUTO_FACTS_THREADS_MAX,
  AUTO_GATES,
  AUTO_LEDGER_CHAR_BUDGET,
  AUTO_LEDGER_MAX_ARTIFACTS,
  AUTO_LEDGER_OUTLINE_CHARS,
  AUTO_MAX_OPEN_CHILDREN,
  AUTO_OUTBOX_CLAIM_MS,
  AUTO_OWNER_LEASE_MS,
  AUTO_REVISE_ASK_CHARS,
  AUTO_SUBSTEP_PARENT_SLACK_MS,
  AUTO_SUBSTEPS_PER_PARENT,
  AUTO_TREE_DEPTH,
  AUTO_TREE_LIMITS,
  AUTO_TURN_CEILING_USD,
} from './auto/limits';
export {
  delegationDepthOf,
  isAutoSubstepRole,
  parseSubstepNeeds,
  substepLinkOf,
} from './auto/substep';
export type { AutoSubstepRole, SubstepLink } from './auto/substep';
export type { AdmissionParentFacts, AdmissionSubstep } from './auto/substepAdmission';
export {
  autoBudgetOf,
  autoBudgetLabel,
  autoBudgetPromptLine,
  autoBudgetUsedUsd,
  autoRemainingForGates,
  autoTreeSpendOf,
  capTextOf,
  type AutoBudgetFacts,
} from './auto/budget';
export {
  artifactOutline,
  buildArtifactLedgerBlock,
  effectiveApproval,
  type AutoApprovalView,
  type AutoLedgerEntry,
} from './auto/ledger';
export { autoTreeCapUsd, type AutoTreeCapParams } from './auto/treeCap';
export { autoTreeLimitOf } from './auto/treeLimitOf';
export {
  diagnoseResume,
  type DiagnoseResumeParams,
  type ResumeVerdict,
} from './auto/resumeAdmission';
export {
  diagnoseAdmission,
  type AdmissionArtifactFacts,
  type AdmissionArtifactRef,
  type AdmissionChild,
  type AdmissionChildRefusal,
  type AdmissionLiveArtifact,
  type AdmissionSnapshot,
  type AdmissionVerdict,
} from './auto/admission';
export {
  AUTO_LIMIT_REFUSAL_CODES,
  AUTO_REFUSAL_CODES,
  isAutoLimitRefusal,
  type AutoRefusalCode,
} from './auto/refusals';
export { AUTO_REFUSAL_USER_REASON, autoRefusalUserReason } from './auto/refusalUserReason';
export { DEFAULT_AUTO_LEVEL, type AutoLevel } from './auto/level';
export { outcomeLineOf, stripOutcomeLine, type OutcomeLine } from './auto/outcome';
export { AUTO_SYSTEM_PROMPT, autoRoleCatalog, buildAutoSystemPrompt } from './auto/prompt';
export {
  parseRevisionFromTurn,
  type ParseRevisionParams,
  type RevisionFailure,
  type RevisionParseOutcome,
} from './auto/revisionParse';
export {
  ATTRIBUTION_CLEAN,
  ATTRIBUTION_LIST_CAP,
  attributeChanges,
  type AttributeChangesParams,
  type AttributedChanges,
  type MountSnapshot,
  type SnapshotEntry,
} from './auto/attribution';
export { pathsOfPatch, type PathsOfPatchParams } from './auto/patchPaths';
export {
  AUTO_BLOCK_REASONS,
  AUTO_BLOCK_TEXT,
  AUTO_STALE_DECIDE_TEXT,
  turnGate,
  type AutoBlockReason,
  type TurnGateParams,
} from './auto/turnGate';
export { isAutoGateBlock } from './auto/isAutoGateBlock';
export { AUTO_REFUSAL_TEXT, describeAutoRefusal, type RefusalChild } from './auto/refusalText';
export {
  AUTO_CHILD_PROVIDERS,
  AUTO_OWN_PROVIDERS,
  AUTO_UNCONFINED_PROVIDERS,
  isAutoChildProvider,
  isAutoProviderResuming,
  isAutoOwnProvider,
} from './auto/providers';
export {
  DELEGATE_FIELD_CHARS,
  DELEGATE_LIST_MAX,
  DELEGATE_REASON_CHARS,
  DELEGATE_TASK_CHARS,
  DELEGATE_TITLE_WORDS,
  hashDelegateChildren,
  parseDelegateSpec,
  type DelegateChildRefusal,
  type DelegateChildSpec,
  type DelegateRevise,
  type DelegateSpecOutcome,
} from './auto/delegateSpec';
export {
  composeBriefDecisions,
  decisionNumberOf,
  type BriefDecisionRow,
} from './auto/briefDecisions';
export {
  composeBranchFacts,
  type BranchFacts,
  type BranchFactsCheck,
  type BranchFactsCommit,
  type BranchFactsPart,
  type BranchFactsRequest,
  type BranchFactsThread,
} from './auto/branchFacts';
export {
  AUTO_DEFAULT_DONE_WHEN,
  AUTO_DEFAULT_EXPECTED,
  AUTO_KICKOFF_HEADER,
  composeAnswerKickoff,
  composeDelegationKickoff,
  type AnswerKickoffParams,
  type DelegationKickoffParams,
  type KickoffArtifactInput,
  type KickoffHistoryEntry,
  type KickoffRevise,
} from './auto/kickoff';
export {
  parseChildClosing,
  type ChildClosing,
  type ChildCompletion,
  type ChildQuestion,
} from './auto/closing';
export {
  DELEGATION_RESULT_SCHEMA_VERSION,
  DELEGATION_SUMMARY_CHARS,
  buildDelegationResult,
  renderDelegationResult,
  resolveDelegationOutcome,
  type BuildResultParams,
  type DelegationOutcome,
  type DelegationResultV1,
  type FileOwnership,
  type ProcessExit,
  type ResolveOutcomeParams,
  type ResolvedOutcome,
  type ResultArtifact,
  type ResultChangedFile,
  type ChecksNotRunReason,
  type ResultCheck,
  type ResultChecksRun,
  type ResultQuestion,
  type ResultRemote,
} from './auto/result';
export {
  AUTO_CHECK_TIMEOUT_MS,
  canRerunChecks,
  checksRunOfResult,
  checksTextOf,
  checksVerdictOf,
  missingChecksOf,
  notCheckedOf,
  type CheckReport,
  type ChecksVerdict,
} from './auto/checks';
export {
  CHECKS_RED_HOLD,
  PUBLISH_MAX_TRIES,
  canPutBackPublish,
  canRetryPublish,
  parseDelegatePublish,
  publishGateOf,
  publishOfRequest,
  publishOfResult,
  publishTextOf,
  type DelegatePublish,
  type PublishGate,
  type PublishMode,
  type PublishState,
  type ResultPublish,
} from './auto/publish';
export { remoteVerdictOf, type RemoteRead, type RemoteVerdictParams } from './auto/remoteWatch';
export {
  EMPTY_USER_FACTS,
  isQuestionPayload,
  isResultsPayload,
  isRefusalPayload,
  isUserPayload,
  storedDeliveryOf,
  type QuestionPayload,
  type ResultsPayload,
  type StoredDelivery,
  type UserFacts,
  type RefusalPayload,
  type UserPayload,
} from './auto/outboxPayload';
export {
  buildArtifactBodiesBlock,
  buildStateDigest,
  type ArtifactBodiesParams,
  type DeliveryArtifactBody,
  type DigestDelegation,
  type DigestQuestion,
  type StateDigestParams,
} from './auto/digest';
export {
  AUTO_BLOCK_ACTIONS,
  AUTO_BLOCK_CLOSE,
  AUTO_BLOCK_OPEN,
  parseAutoBlock,
  type AutoBlock,
  type AutoBlockOutcome,
  type ParseAutoBlockParams,
} from './auto/autoBlock';
export {
  AUTO_RESTART_NOTICE,
  buildDeliveryText,
  type BuildDeliveryParams,
  type DeliveryRow,
} from './auto/delivery';
export {
  describeMounts,
  isUsableMount,
  pickAutoMount,
  type MountPickOutcome,
  type MountPickRefusalCode,
  type PickMountParams,
  type PickableMount,
} from './auto/mountPick';
export { buildMountsLine } from './auto/mountsLine';
export {
  ADOPTION_DEFAULT_INSTRUCTION,
  ADOPTION_REFUSAL_TEXT,
  adoptionRoleOf,
  buildAdoptedResult,
  composeAdoptionKickoff,
  diagnoseAdoption,
  isAdoptableKind,
  type AdoptedResultParams,
  type AdoptionArtifactRef,
  type AdoptionKickoffParams,
  type AdoptionRefusalCode,
  type AdoptionSnapshot,
} from './auto/adoption';
export {
  AUTO_DELEGATION_ROLES,
  AUTO_ROLE_ARTIFACT,
  AUTO_ROLE_WHEN,
  AUTO_WRITER_ROLES,
  isAutoWriterRole,
  parseAutoDelegationRole,
  type AutoArtifactKind as AutoRoleArtifactKind,
  type AutoDelegationRole,
  type AutoWriterRole,
} from './auto/roles';
export {
  AUTO_COMMAND_ROLES,
  canAutoRoleRunCommands,
  doesTaskNeedCommands,
  isMissingShellText,
  rerouteHintOf,
  roleCannotRunCommandsMessage,
} from './auto/roleTools';

export {
  ROLE_REGISTRY,
  SELECTABLE_AGENT_ROLES,
  defaultsForRole,
  fanOutCapabilityForRole,
  isAgentRole,
  normalizeAgentRole,
  normalizeSelectableAgentRole,
  normalizeWorkflowRole,
  presentationKeyForRole,
  roleSplitLimits,
  fanOutDepthCapForRole,
  FAN_OUT_MAX_CHILDREN,
  SCOUT_DEPTH_CAP,
  type AgentEffort,
  type AgentRole,
  type RoleExplain,
  type RoleSplitLimits,
  type RoleFanOutCapability,
  type RoleFanOutMode,
  type RoleFanOutPartitionKey,
  type RoleDefaults,
  type RoleOutputKind,
  type RolePresentationKey,
  type RoleRegistryEntry,
} from './roles';

export {
  ARTIFACT_MAX_BYTES,
  ARTIFACT_SCHEMA_VERSION,
  captureArtifactFromTurnText,
  parseArtifactEnvelope,
  parseLegacyPlanMarkers,
  scanArtifactBlocks,
  locateArtifactSpans,
  type ArtifactCaptureError,
  type ArtifactCaptureErrorCode,
  type ArtifactCaptureResult,
  type ArtifactOrigin,
  type ArtifactScanState,
  type ParsedArtifact,
  type ParsedPlanArtifact,
  type ParsedReportArtifact,
  type ParsedWireframeArtifact,
} from './artifacts';

export {
  GENERIC_THEME_NAME,
  WIREFRAME_BUTTON_VARIANTS,
  WIREFRAME_IMAGE_RATIOS,
  WIREFRAME_INPUT_TYPES,
  WIREFRAME_LIMITS,
  WIREFRAME_NAVIGATION_VARIANTS,
  WIREFRAME_NODE_KINDS,
  PLAN_KIT_GUIDE,
  REPORT_KIT_GUIDE,
  WIREFRAME_SCHEMA_BRIEF,
  WIREFRAME_JSON_SCHEMA_ID,
  buildWireframeJsonSchema,
  WIREFRAME_SCHEMA_VERSION,
  WIREFRAME_TEXT_VARIANTS,
  WIREFRAME_THEME_COLOR_TOKENS,
  WIREFRAME_VIEWPORTS,
  parseWireframeSource,
  validateWireframeDocument,
  walkWireframeNodes,
  wireframeNodeChildren,
  wireframeNodeItemIds,
  type WireframeAction,
  type WireframeAlignment,
  type WireframeButtonNode,
  type WireframeButtonVariant,
  type WireframeDevice,
  type WireframeDirection,
  type WireframeDocument,
  type WireframeGridNode,
  type WireframeImageNode,
  type WireframeImageRatio,
  type WireframeInputNode,
  type WireframeInputType,
  type WireframeAdjustment,
  type WireframeAdjustmentChange,
  type WireframeIssue,
  type WireframeJustification,
  type WireframeListItem,
  type WireframeListNode,
  type WireframeNavigationItem,
  type WireframeNavigationNode,
  type WireframeNavigationVariant,
  type WireframeNode,
  type WireframeNodeKind,
  type WireframeScreen,
  type WireframeScreenState,
  type WireframeSpacing,
  type WireframeStackNode,
  type WireframeTableNode,
  type WireframeTextNode,
  type WireframeTextVariant,
  type WireframeTheme,
  type WireframeThemeColorToken,
  type WireframeThemeFont,
  type WireframeThemeRadius,
  type WireframeTransition,
  type WireframeValidationResult,
  type WireframeVariant,
  type WireframeViewport,
} from './artifacts';

export { classifyFirstTurn, type AgentKindLabel } from './first-turn-classifier';

export { ROLE_LIBRARY, type RoleLibraryEntry, type RoleLibraryGroup } from './profile/roleLibrary';
export { matchRoleLibrary } from './profile/matchRoleLibrary';
export { PROFILE_ACCESS, type ProfileAudience, type ProfileField } from './profile/profileAccess';

export {
  sessionLanguageRule,
  sessionLanguageTurnRule,
  type SessionLanguageRuleParams,
} from './language';

export { PROVIDER_ID_TO_NAME, resolveProvider, type ResolveProviderInput } from './budget/router';

export { computeCostUsd, priceFor } from './providers/claude/cost';
export { getProviderModelPrice } from './providers/model-price';
export {
  OPENCODE_ROUTING,
  PROVIDER_KIND,
  isApiProvider,
  opencodeModelArg,
} from './providers/provider-catalog';
export { PROVIDER_LIFECYCLE_COMMANDS, canLogout } from './providers/provider-commands';
export { cleanCliVersion, isCliVersionBelow, newestCliVersion } from './providers/cliVersion';
export {
  cliGate,
  cliSupportedSibling,
  outdatedCliModels,
  type CliGate,
  type CliRequirement,
} from './providers/cliGate';
export { PROVIDER_CONNECT_CAPABILITIES } from './providers/provider-connect';
export { DEFAULT_SESSION_PROVIDER_PREFERENCE } from './providers/provider-preference';
export { CLI_CREDENTIAL } from './providers/provider-credential';
export { PROVIDER_API_KEY_ENV } from './providers/provider-api-key-env';
export { TASKS } from './settings/tasks';
export { DEFAULT_GROUPS, type DefaultGroups, type DefaultsGroup } from './settings/defaultGroups';
export { parseStreamJsonLine, type ParseContext } from './providers/claude/parser';
export { parseCodexRateLimits } from './providers/limits/parseCodexRateLimits';
export {
  parseCodexAppServerLimits,
  parseCodexResetCredits,
} from './providers/limits/parseCodexAppServerLimits';
export {
  parseResetOutcome,
  resetAdvice,
  type ResetAdvice,
  type ResetOutcome,
} from './providers/limits/resetAdvice';
export {
  claudeUsageResultTextOf,
  parseClaudeUsageProbeOutput,
  parseClaudeUsageText,
} from './providers/limits/parseClaudeUsageText';
export { mergeProviderLimits } from './providers/limits/mergeProviderLimits';
export { sortLimitWindows } from './providers/limits/sortLimitWindows';
export { LIMITS_STALE_MS, LIMITS_WARNING_FRACTION } from './providers/limits/constants';
export {
  PROVIDERS_REPORTING_LIMITS,
  limitsChipOf,
  selectLimitsChips,
  worstLimitsChip,
  type LimitsChip,
  type LimitsChipState,
} from './providers/limits/selectLimitsChips';
export { providersAtLimit } from './providers/limits/providersAtLimit';

export {
  PROVIDER_CAPABILITIES,
  getCapabilities,
  getDefaultTurnModel,
} from './providers/capabilities';

export {
  PROVIDER_FLAGS,
  providerFlags,
  providersOnSameBinary,
  type ProviderFlags,
  type ProviderStatusSlot,
} from './providers/providerFlags';

export {
  autoModelForRole,
  recommendedModelForRole,
  type AutoModelChoice,
} from './providers/auto-model';

export { resolveModelForProvider } from './providers/model-map';
export { resolveModelIdForProvider } from './providers/resolveModelIdForProvider';
export { canonicalModelId } from './providers/canonicalModelId';
export { modelCatalogKey } from './providers/modelCatalogKey';
export { MODEL_CATALOGS } from './providers/catalogs';
export { catalogModelForId } from './providers/catalogModelForId';
export { ANTHROPIC_CATALOG } from './providers/claude/catalog';
export { CODEX_CATALOG } from './providers/codex/catalog';
export { CURSOR_CATALOG } from './providers/cursor/catalog';
export { OPENCODE_CATALOG } from './providers/opencode/catalog';
export { OPENROUTER_CATALOG } from './providers/openrouter/catalog';
export { defaultModelSelection } from './providers/defaultModelSelection';
export { modelIdForSelection } from './providers/modelIdForSelection';
export { parseLegacyId } from './providers/parseLegacyId';
export { remapModelSelection } from './providers/remapModelSelection';
export { resolveCursorCombo } from './providers/cursorCombo';
export { modelAxes } from './providers/modelAxes';
export {
  isModelHidden,
  legacyHiddenModels,
  parseHiddenModels,
  selectableModels,
  visibleCatalog,
  visibleModelCount,
  withModelsVisible,
  type HiddenModels,
} from './providers/modelVisibility';
export { modelHasEffortAxis } from './providers/modelHasEffortAxis';
export { clampEffortForModel, modelEffortLevels } from './providers/clampEffortForModel';
export { resolveModelArgs } from './providers/resolveModelArgs';
export {
  PROVIDER_ARG_FLAGS,
  extractSpawnModel,
  type ProviderArgFlags,
} from './providers/providerArgFlags';
export { resolveStoredModelSelection } from './providers/resolveStoredModelSelection';
export { resolvedStoredModelId } from './providers/resolvedStoredModelId';
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

export {
  nextRoleModelChoice,
  resolveRoleChoice,
  resolveRoleRouting,
  roleModelChoices,
  roleModelSetPreference,
  type PinnedUnavailable,
  type ResolvedRoleChoice,
  type ResolvedRoleRouting,
} from './providers/role-models';
export {
  resolveAuto,
  type AutoContext,
  type AutoPick,
  type AutoSlot,
  type AutoStep,
} from './providers/autoRouting/resolveAuto';
export {
  enabledProvidersOf,
  firstOnProvider,
  providerCandidates,
  providerStanding,
  seedProviderPolicy,
  workingProviders,
  type ProviderCandidatesContext,
  type ProviderStanding,
} from './providers/autoRouting/providerCandidates';
export {
  PROVIDER_HEADROOM_STALE_MS,
  providerHeadroom,
  providersByHeadroom,
  readHeadroom,
  type HeadroomMap,
  type HeadroomReading,
  type ProviderHeadroom,
} from './providers/limits/providerHeadroom';
export {
  AUTO_DEFAULTS,
  isCuratedProvider,
  type CuratedProviderId,
} from './providers/autoRouting/defaults';
export { isSizeMovingRung } from './providers/autoRouting/slotRungs';
export {
  classifyRequest,
  type ClassifiedRole,
  type RequestClassification,
  type RequestClassifierResult,
  type RequestDifficulty,
} from './classifier/requestClassifier';
export { workflowModelProfile } from './providers/workflowModelProfiles';
export { latestInGroup, type ModelLine } from './providers/latestInGroup';

export { getCheapModel, getDefaultBinary } from './providers/cli-defaults';
export {
  planTurnFallback,
  type TurnFailureKind,
  type TurnFallbackPlan,
} from './providers/planTurnFallback';
export { fallbackWantsThinker } from './providers/fallbackWantsThinker';
export { strongestModelForTier } from './providers/strongestModelForTier';
export { planAlternateTaskModel, planTaskModelFallback } from './providers/task-model-fallback';
export {
  runWithModelFallback,
  type BackgroundAttempt,
  type BackgroundPool,
  type BackgroundResult,
} from './providers/background-retry';
export { cliModelId } from './providers/cliModelId';
export {
  createJsonLineAssembler,
  type JsonLineAssembler,
  type JsonLineAssemblerResult,
} from './providers/shared/createJsonLineAssembler';
export { extractAuxOutput, type AuxOutput, type AuxUsage } from './providers/aux-output';
export { runAuxOneShot, type AuxSpawnResult } from './providers/aux-spawn';
export { AuxTimedOutError } from './providers/auxTimedOut';

export { getModelDescriptor, getModelProvider } from './providers/model-display';
export { computeProviderCostUsd } from './providers/provider-cost';
export { contextTokensForUsage, inputTokensForUsage } from './providers/context-tokens';

export { assessTurnWeight, type TurnWeight } from './providers/turn-weight';
export { costCoverage, type CostCoverage } from './providers/cost-coverage';

export { computeCursorCostUsd } from './providers/cursor/cost';
export { CURSOR_AUTO_MODEL, CURSOR_MODELS } from './providers/cursor/models';
export { parseCursorStreamLine } from './providers/cursor/parser';

export {
  parseSlashCommand,
  serializeSkillMarkdown,
  SkillExecutor,
  SkillScriptError,
  type SkillScriptRunner,
} from './skills';

export { computeCodexCostUsd } from './providers/codex/cost';
export { parseJsonLine as parseCodexJsonLine } from './providers/codex/parser';

export { OPENROUTER_MODELS } from './providers/openrouter/constants';
export { computeOpenCodeCostUsd } from './providers/opencode/cost';
export { parseJsonLine as parseOpenCodeJsonLine } from './providers/opencode/parser';

export { parseJsonLine as parseCopilotJsonLine } from './providers/copilot/parser';
export { computeGeminiCostUsd } from './providers/gemini/cost';
export { parseJsonLine as parseGeminiJsonLine } from './providers/gemini/parser';

export {
  Summarizer,
  SummarizerCliError,
  SummarizerParseError,
  SummarizerSpawnError,
  LearningExtractor,
  LearningExtractorError,
  annotateFallbackStepOutputSummary,
  fallbackStepOutputMarker,
  fallbackStepOutputSummary,
  isFallbackStepOutputSummary,
  previewStepOutputSummary,
  rewriteWorkflowGoal,
  generateIssueBrief,
  summarizeStepOutput,
  parseLearningCandidates,
  buildGoalRewriteUserPrompt,
  type ContextSlotDelta,
  type ContextSlotDeltaUpsert,
  type GoalRewriteDeps,
  type GoalRewriteInput,
  type IssueBrief,
  type IssueBriefDeps,
  type IssueBriefFailure,
  type IssueBriefInput,
  type IssueBriefResult,
  type LearningCandidate,
  type LearningExtractionInput,
  type LearningExtractionResult,
  type LearningExtractorDeps,
  type SummarizeInput,
  type SummarizeMode,
  type SummarizerDeps,
  type SummarizerResult,
  type SummarizerUsage,
} from './summarizer';

export {
  buildChainCarryForward,
  buildParallelCarryForward,
  buildStepPrompt,
  classifyWorkflowChain,
  findReusableAgent,
  isWorkflowComplete,
  isAgentSettled,
  isAgentStatusHalted,
  isAgentStatusSettled,
  runsForWorkflowRun,
  type ChainCarryForwardStep,
  type ParallelCarryForwardBranch,
  type WorkflowChainState,
  WORKFLOW_LIBRARY,
  BUILTIN_STEPS,
  builtinStepForRole,
  isBuiltinStepId,
  type BuiltinStep,
  type WorkflowLibraryEntry,
  type WorkflowLibraryStep,
  findBuiltinWorkflow,
  seedWorkflowLibrary,
  restoreWorkflowLibrary,
  seedMissingBuiltinWorkflows,
  type SeedMissingResult,
  type RestoreWorkflowLibraryParams,
  type SeedResult,
  type SeedWorkflowLibraryDeps,
  WorkflowRestoreError,
  type WorkflowRestoreErrorKind,
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
  GUIDANCE_POLISH_SYSTEM_PROMPT,
  parsePolishedGuidance,
  polishWorkflowGuidance,
  polishStepInstruction,
  polishStepExpectedOutput,
  parsePolishedStep,
  type StepPolishDeps,
  type StepPolishInput,
  type ExpectedOutputPolishInput,
} from './workflows';

export {
  PermissionEngine,
  type PermissionEngineDeps,
  parseToolPattern,
  formatToolPattern,
  type ToolMatcher,
  buildClaudeFlags,
  type ClaudeFlagSet,
  modeSupportFor,
  resolveModeFor,
  type ModeSupport,
  type ModeSupportLevel,
  commandPrefix,
  isFilePathTool,
  oncePatternText,
  prefixRuleFor,
  type ActionTarget,
  type PrefixRule,
} from './permissions';

export { resolveSettings, type ResolveSettingsInput } from './settings/resolver';
export { devWarn } from './dev-log';

export {
  DEFAULT_PR_CACHE_TTL_MS,
  GhCliError,
  GhJsonParseError,
  GhJsonShapeError,
  createGithubRepo,
  createIssueComment,
  detectRepoSlug,
  fetchLinkedIssues,
  fetchPrDetail,
  getPrForBranch,
  invalidatePrCache,
  REVIEW_REPLY_SAMPLE_SIZE,
  learnReplyStyle,
  listAssignedIssues,
  listInboxPullRequests,
  listIssueComments,
  listMyReviewReplies,
  listOpenPrBranches,
  type OpenPrBranch,
  listOwnedRepos,
  parseStyleNote,
  type ReplyStyleDeps,
  type ReviewReply,
  listPrsForBranch,
  addPullRequestReview,
  addReviewThreadReply,
  fetchPrNodeId,
  parseLinkedIssuesFromBody,
  parseUnifiedDiff,
  resolvePrForBranch,
  resolveReviewThread,
  viewPullRequest,
  updateReviewComment,
  runJson as ghRunJson,
  toCachedPullRequest,
  updateIssueBody,
  validateGithubRepoName,
  type CreateRepoResult,
  type GetPrInput,
  type GhResult,
  type GhRunOptions,
  type GhRunner,
  type GithubRepoRef,
  type GithubRepoVisibility,
  type OwnedReposResult,
  type PostedPullRequestReview,
  type PostedThreadReply,
  type PrCacheDeps,
  type PrCacheStore,
  type RepoNameCheck,
  type ResolvedThread,
  type ReviewEvent,
  type ReviewFileThreadDraft,
  type ReviewThreadDraft,
} from './github';

export {
  BITBUCKET_NO_RESOLVE,
  BITBUCKET_PR_STATE_KIND,
  BITBUCKET_THREAD_PREFIX,
  GITLAB_THREAD_PREFIX,
  LOCAL_NOTE_NO_REPLY,
  NOTE_THREAD_PREFIX,
  PULL_REQUEST_CAPABILITY_METHODS,
  PULL_REQUEST_NOUNS,
  PullRequestPortError,
  STALE_HEAD_MESSAGE,
  PullRequestPortUnsupported,
  REVIEW_SOURCE_CAPABILITIES,
  REVIEW_SOURCE_LABEL,
  bitbucketCheckRuns,
  bitbucketChecksOf,
  bitbucketCommentId,
  bitbucketPrStateKind,
  bitbucketPullRequestPort,
  bitbucketReviewDecisionOf,
  bitbucketReviewSource,
  bitbucketThreadId,
  bitbucketThreadsOf,
  commitLinkOf,
  githubPullRequestPort,
  githubReviewSource,
  gitlabDiscussionId,
  gitlabDraftTitle,
  gitlabDefaultMergeMethodOf,
  gitlabMergeableOf,
  gitlabPullRequestPort,
  gitlabReviewDecisionOf,
  gitlabReviewSource,
  gitlabStateKindOf,
  gitlabThreadId,
  gitlabThreadsOf,
  groupReviewComments,
  isPullRequestPortError,
  isPullRequestPortUnsupported,
  localReviewSource,
  pullRequestReviewersOf,
  pullRequestReviewerGroupsOf,
  isBotLogin,
  type PullRequestReviewerGroups,
  requirePullRequestCapability,
  stripGitlabDraftPrefix,
  type GitlabPullRequestTransport,
  type BitbucketMergeStrategy,
  type BitbucketPortCommit,
  type BitbucketPortParticipant,
  type BitbucketPortPullRequest,
  type BitbucketPortStatus,
  type BitbucketPortUser,
  type BitbucketPullRequestStateName,
  type BitbucketPullRequestTransport,
  type BitbucketReviewComment,
  type BitbucketReviewTransport,
  type BitbucketStatusState,
  type GitlabReviewDiscussion,
  type GitlabReviewNote,
  type GitlabReviewTransport,
  type PullRequestCapability,
  type PullRequestFailureKind,
  type PullRequestPort,
  type ReviewSource,
  type ReviewSourceCapabilities,
  type ReviewSourceKind,
  type ReviewSourceReply,
  type ReviewSourceResolution,
  type ReviewSourceThread,
} from './review-source';

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

export {
  EMPTY_DURATION_HISTORY,
  ESTIMATE_WINDOW_MS,
  buildDurationHistory,
  estimateDuration,
  estimateOrchestratedRun,
  estimateProgress,
  sumEstimates,
  unionDurationMs,
  type CostRange,
  type DurationEstimate,
  type DurationHistory,
  type DurationSample,
  type DurationUnit,
  type EstimateKey,
  type EstimateProgress,
  type EstimateTier,
  type EstimateTotal,
  type RunDurationSample,
  type TimeInterval,
} from './estimates';

export {
  buildHandoff,
  composeHandoffBody,
  handoffLine,
  hasSeparateSystemPrompt,
  renderCurrentPlan,
  renderHandoff,
  type BuildHandoffParams,
  type HandoffBodyLayers,
  type HandoffClusterBoundary,
  type HandoffEarlierStep,
  type HandoffFile,
  type HandoffLayers,
  type HandoffRole,
  type HandoffRule,
  type HandoffThread,
  type RenderedHandoff,
} from './handoff';

export {
  formatWorkflowModelMenu,
  hintedRoutingOutcome,
  parseOrchestratorDecision,
  parseWorkflowRoutingProposal,
  recommendWorkflowModel,
  recommendWorkflowRoutingDecision,
  resolveWorkflowRouting,
  workflowRoutingAvailability,
  buildOrchestratorUserPrompt,
  orchestratorModelPool,
  roleModelSetMenu,
  keepProposalInRoleSet,
  stepSizeForDifficulty,
  parseRunSummaryText,
  serializeRunSummary,
  ORCHESTRATOR_SYSTEM_PROMPT,
  OrchestratorClient,
  OrchestratorClientSpawnError,
  OrchestratorProviderError,
  type OrchestratorClientDeps,
  type OrchestratorClientResult,
  type OrchestratorCompletedStep,
  type OrchestratorDecision,
  type OrchestratorInput,
  type OrchestratorModelOption,
  type OrchestratorRoleDefault,
  type OrchestratorStep,
  type OrchestratorUsage,
  type WorkflowMissingProposalPolicy,
  type WorkflowModelCandidate,
  type WorkflowModelRecommendation,
  type WorkflowRoutingAvailability,
  type WorkflowRoutingAvailabilitySnapshot,
  type WorkflowRoutingProposalParseOutcome,
  type WorkflowRoutingRequestedIdentity,
  type WorkflowRoutingResolution,
  type WorkflowRoutingUnavailableCause,
  type WorkflowRoutingWireFields,
  type RunSummary,
} from './orchestrator';
export {
  diffWireframeDocuments,
  type WireframeDiff,
  type WireframeDiffSummary,
  type WireframeNodeChange,
  type WireframeNodeChangeKind,
  type WireframeScreenChange,
  type WireframeScreenChangeKind,
} from './artifacts';
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
} from './providers/resolve';

export {
  attributePorts,
  collectLearnedPorts,
  findLeftovers,
  pathContains,
  type AttributionProject,
  type AttributionSession,
  type AttributionWorktree,
  type HiddenPort,
  type HiddenPortSource,
  type LearnedPorts,
  type LedgerKind,
  type LedgerRow,
  type Leftover,
  type MonitorListener,
  type MonitorProcess,
  type MonitorSnapshot,
  type PinnedPort,
  type PortOwner,
  type PortRow,
  type PortState,
  type WatchedByProject,
  type WatchedPort,
  type WatchedSource,
} from './monitoring';
