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
} from './limits';

export { delegationDepthOf, isAutoSubstepRole, parseSubstepNeeds, substepLinkOf } from './substep';

export type { AutoSubstepRole, SubstepLink } from './substep';

export type { AdmissionParentFacts, AdmissionSubstep } from './substepAdmission';

export {
  autoBudgetOf,
  autoBudgetLabel,
  autoBudgetPromptLine,
  autoBudgetUsedUsd,
  autoRemainingForGates,
  autoTreeSpendOf,
  capTextOf,
  type AutoBudgetFacts,
} from './budget';

export {
  artifactOutline,
  buildArtifactLedgerBlock,
  effectiveApproval,
  type AutoApprovalView,
  type AutoLedgerEntry,
} from './ledger';

export { autoTreeCapUsd, type AutoTreeCapParams } from './treeCap';

export { autoTreeLimitOf } from './treeLimitOf';

export { diagnoseResume, type DiagnoseResumeParams, type ResumeVerdict } from './resumeAdmission';

export {
  diagnoseAdmission,
  type AdmissionArtifactFacts,
  type AdmissionArtifactRef,
  type AdmissionChild,
  type AdmissionChildRefusal,
  type AdmissionLiveArtifact,
  type AdmissionSnapshot,
  type AdmissionVerdict,
} from './admission';

export {
  AUTO_LIMIT_REFUSAL_CODES,
  AUTO_MOUNTED_CODE,
  AUTO_REFUSAL_CODES,
  isAutoLimitRefusal,
  isAutoMountedCode,
  type AutoRefusalCode,
} from './refusals';

export { AUTO_REFUSAL_USER_REASON, autoRefusalUserReason } from './refusalUserReason';

export { DEFAULT_AUTO_LEVEL, type AutoLevel } from './level';

export { outcomeLineOf, parseOutcomeLine, stripOutcomeLine } from './outcome';

export type { OutcomeLine } from './outcome';

export { AUTO_SYSTEM_PROMPT, autoRoleCatalog, buildAutoSystemPrompt } from './prompt';

export {
  parseRevisionFromTurn,
  type ParseRevisionParams,
  type RevisionFailure,
  type RevisionParseOutcome,
} from './revisionParse';

export {
  ATTRIBUTION_CLEAN,
  ATTRIBUTION_LIST_CAP,
  attributeChanges,
  type AttributeChangesParams,
  type AttributedChanges,
  type MountSnapshot,
  type SnapshotEntry,
} from './attribution';

export { pathsOfPatch, type PathsOfPatchParams } from './patchPaths';

export {
  AUTO_BLOCK_REASONS,
  AUTO_BLOCK_TEXT,
  AUTO_STALE_DECIDE_TEXT,
  turnGate,
  type AutoBlockReason,
  type TurnGateParams,
} from './turnGate';

export { autoRefusedBlockText, isAutoGateBlock } from './isAutoGateBlock';

export { AUTO_REFUSAL_TEXT, describeAutoRefusal, type RefusalChild } from './refusalText';

export {
  AUTO_CHILD_PROVIDERS,
  AUTO_OWN_PROVIDERS,
  AUTO_UNCONFINED_PROVIDERS,
  isAutoChildProvider,
  isAutoProviderResuming,
  isAutoOwnProvider,
} from './providers';

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
} from './delegateSpec';

export { composeBriefDecisions, decisionNumberOf, type BriefDecisionRow } from './briefDecisions';

export {
  composeBranchFacts,
  type BranchFacts,
  type BranchFactsCheck,
  type BranchFactsCommit,
  type BranchFactsPart,
  type BranchFactsRequest,
  type BranchFactsThread,
} from './branchFacts';

export {
  composeAnswerKickoff,
  composeDelegationKickoff,
  type AnswerKickoffParams,
  type DelegationKickoffParams,
  type KickoffArtifactInput,
  type KickoffHistoryEntry,
  type KickoffRevise,
} from './kickoff';

export {
  parseChildClosing,
  type ChildClosing,
  type ChildCompletion,
  type ChildQuestion,
} from './closing';

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
} from './result';

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
} from './checks';

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
} from './publish';

export { remoteVerdictOf, type RemoteRead, type RemoteVerdictParams } from './remoteWatch';

export {
  EMPTY_USER_FACTS,
  isQuestionPayload,
  isResultsPayload,
  isRefusalPayload,
  isUserPayload,
  mountNoteOf,
  storedDeliveryOf,
  type MountNote,
  type QuestionPayload,
  type ResultsPayload,
  type StoredDelivery,
  type UserFacts,
  type RefusalPayload,
  type UserPayload,
} from './outboxPayload';

export {
  buildArtifactBodiesBlock,
  buildStateDigest,
  type ArtifactBodiesParams,
  type DeliveryArtifactBody,
  type DigestDelegation,
  type DigestQuestion,
  type StateDigestParams,
} from './digest';

export {
  AUTO_BLOCK_CLOSE,
  AUTO_BLOCK_OPEN,
  parseAutoBlock,
  type AutoBlock,
  type AutoBlockOutcome,
  type ParseAutoBlockParams,
} from './autoBlock';

export { parseProposeSpec } from './proposeSpec';

export { buildDeliveryText, type BuildDeliveryParams, type DeliveryRow } from './delivery';

export {
  describeMounts,
  isUsableMount,
  pickAutoMount,
  type MountPickOutcome,
  type MountPickRefusalCode,
  type PickMountParams,
  type PickableMount,
} from './mountPick';

export { buildMountsLine } from './mountsLine';
export { parseMountSpec, type MountSpec } from './mountSpec';

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
} from './adoption';

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
} from './roles';

export {
  AUTO_COMMAND_ROLES,
  canAutoRoleRunCommands,
  commandMentionOf,
  isMissingShellText,
  rerouteHintOf,
  roleCannotRunCommandsMessage,
} from './roleTools';
export { AUTO_WITHDRAWN_REASON } from './AUTO_WITHDRAWN_REASON';
