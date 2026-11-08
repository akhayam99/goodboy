import type { AutoOutcome } from '@goodboy/db';
import { isRecord } from '@goodboy/types/helpers';
import { oneLine } from './oneLine';
import type { ChildClosing, ChildCompletion, ChildReturn } from './closing';
import { checksTextOf } from './checks';
import { publishTextOf, type ResultPublish } from './publish';
import { STEP_OUTPUT_EXCERPT_CHARS } from '../summarizer/step-output';
import { isMissingShellText, rerouteHintOf } from './roleTools';
import type { AutoDelegationRole } from './roles';

export const DELEGATION_RESULT_SCHEMA_VERSION = 1;
export const DELEGATION_SUMMARY_CHARS = STEP_OUTPUT_EXCERPT_CHARS;

export type DelegationOutcome = AutoOutcome;

export type ProcessExit = 'ok' | 'error' | 'cancelled' | 'unknown';

export type FileOwnership = 'attempt' | 'preexisting' | 'unattributed';

export type ResultArtifact = Readonly<{
  id: string;
  kind: 'plan' | 'report' | 'wireframe';
  title: string;
  contentHash: string;
  revision: number;
  baseRevision: number | null;
}>;

export type ResultQuestion = Readonly<{
  questionId: string;
  text: string;
}>;

export type ResultChangedFile = Readonly<{
  path: string;
  ownership: FileOwnership;
}>;

export type ResultRemote = Readonly<{
  status: 'unchanged' | 'moved' | 'unknown';
  branch: string | null;
  before: string | null;
  after: string | null;
}>;

export type ResultCheck = Readonly<{
  name: string;
  status: 'pass' | 'fail' | 'unknown';
  source: 'harness' | 'child_claim';
}>;

export type ChecksNotRunReason =
  'none_ticked' | 'check_missing' | 'timed_out' | 'tree_moved' | 'tree_dirty' | 'not_available';

export type ResultChecksRun = Readonly<{
  verdict: 'green' | 'red' | 'not_checked';
  reason: ChecksNotRunReason | null;
  commit: string | null;
}>;

export type DelegationResultV1 = Readonly<{
  schemaVersion: 1;
  delegationId: string;
  attemptId: string;
  treeId: string;
  generation: number;
  childAgentId: string;
  role: AutoDelegationRole;
  routing: Readonly<{ provider: string; model: string; effort: string; reason: string }>;
  outcome: DelegationOutcome;
  process: Readonly<{ exit: ProcessExit; turns: number; durationMs: number }>;
  declared: Readonly<{
    completion: ChildCompletion;
    summary: string;
    summarySource: 'child' | 'summarizer' | 'none';
  }>;
  returned?: ChildReturn;
  verified: Readonly<{
    changedFiles: ReadonlyArray<ResultChangedFile>;
    checks: ReadonlyArray<ResultCheck>;
    remote?: ResultRemote;
    checksRun?: ResultChecksRun;
    publish?: ResultPublish;
  }>;
  artifacts: ReadonlyArray<ResultArtifact>;
  artifactPersistence: 'ok' | 'failed' | 'not_written' | 'not_applicable';
  openQuestions: ReadonlyArray<ResultQuestion>;
  cost: Readonly<{ usd: number | null; basis: 'reported' | 'reserved_ceiling' | 'estimate' }>;
  reason: string | null;
}>;

export type ResolveOutcomeParams = Readonly<{
  exit: ProcessExit;
  isTimedOut: boolean;
  closing: ChildClosing | null;
  artifactCount: number;
  artifactPersistence: DelegationResultV1['artifactPersistence'];
  isArtifactExpected: boolean;
}>;

export type ResolvedOutcome = Readonly<{
  outcome: DelegationOutcome;
  reason: string | null;
}>;

type ReturnReasonParams = {
  readonly closing: ChildClosing | null;
};

const returnReasonOf = ({ closing }: ReturnReasonParams): string => {
  const needs = closing?.returned?.needs ?? null;
  if (needs !== null) {
    return `needs_${needs.kind}`;
  }
  return isMissingShellText({ text: closing?.summary ?? '' }) ? 'needs_shell' : 'needs_user';
};

const REROUTE_NEED: ReadonlyMap<string, 'shell' | 'writer'> = new Map([
  ['missing_tool', 'shell'],
  ['needs_shell', 'shell'],
  ['needs_writer', 'writer'],
]);

export const resolveDelegationOutcome = ({
  exit,
  isTimedOut,
  closing,
  artifactCount,
  artifactPersistence,
  isArtifactExpected,
}: ResolveOutcomeParams): ResolvedOutcome => {
  if (isTimedOut) {
    return { outcome: 'timed_out', reason: 'deadline_passed' };
  }
  if (exit === 'cancelled') {
    return { outcome: 'stopped', reason: 'stopped' };
  }
  if (exit === 'error') {
    return { outcome: 'failed', reason: 'process_error' };
  }
  const completion = closing?.completion ?? 'none';
  if (closing?.isLegacyBlock === true && closing.returned?.needs == null) {
    return { outcome: 'blocked', reason: returnReasonOf({ closing }) };
  }
  if (isArtifactExpected && artifactPersistence === 'failed') {
    return { outcome: 'failed', reason: 'artifact_persistence_failed' };
  }
  if (isArtifactExpected && artifactPersistence === 'not_written') {
    return {
      outcome: 'failed',
      reason: completion === 'none' ? 'no_closing_envelope' : 'report_missing',
    };
  }
  if (completion === 'blocked') {
    return { outcome: 'blocked', reason: returnReasonOf({ closing }) };
  }
  if (completion === 'done') {
    return { outcome: 'completed', reason: null };
  }
  const hasArtifacts = artifactCount > 0 && artifactPersistence === 'ok';
  if (exit === 'ok' && hasArtifacts) {
    return { outcome: 'completed', reason: null };
  }
  return { outcome: 'failed', reason: 'no_closing_envelope' };
};

export type BuildResultParams = Readonly<{
  delegationId: string;
  attemptId: string;
  treeId: string;
  generation: number;
  childAgentId: string;
  role: AutoDelegationRole;
  routing: DelegationResultV1['routing'];
  exit: ProcessExit;
  isTimedOut: boolean;
  turns: number;
  durationMs: number;
  closing: ChildClosing | null;
  summary: string | null;
  summarySource: 'child' | 'summarizer' | 'none';
  changedFiles: ReadonlyArray<ResultChangedFile>;
  checks: ReadonlyArray<ResultCheck>;
  remote?: ResultRemote | null;
  checksRun?: ResultChecksRun | null;
  publish?: ResultPublish | null;
  artifacts: ReadonlyArray<ResultArtifact>;
  artifactPersistence: DelegationResultV1['artifactPersistence'];
  isArtifactExpected: boolean;
  openQuestions: ReadonlyArray<ResultQuestion>;
  costUsd: number | null;
}>;

export const buildDelegationResult = (params: BuildResultParams): DelegationResultV1 => {
  const resolved = resolveDelegationOutcome({
    exit: params.exit,
    isTimedOut: params.isTimedOut,
    closing: params.closing,
    artifactCount: params.artifacts.length,
    artifactPersistence: params.artifactPersistence,
    isArtifactExpected: params.isArtifactExpected,
  });
  const summary = (params.summary ?? params.closing?.summary ?? '').slice(
    0,
    DELEGATION_SUMMARY_CHARS,
  );
  return {
    schemaVersion: DELEGATION_RESULT_SCHEMA_VERSION,
    delegationId: params.delegationId,
    attemptId: params.attemptId,
    treeId: params.treeId,
    generation: params.generation,
    childAgentId: params.childAgentId,
    role: params.role,
    routing: params.routing,
    outcome: resolved.outcome,
    process: { exit: params.exit, turns: params.turns, durationMs: params.durationMs },
    declared: {
      completion: params.closing?.completion ?? 'none',
      summary,
      summarySource: summary === '' ? 'none' : params.summarySource,
    },
    ...(resolved.outcome === 'blocked' &&
      params.closing?.returned != null && { returned: params.closing.returned }),
    verified: {
      changedFiles: params.changedFiles,
      checks: params.checks,
      ...(params.remote !== undefined && params.remote !== null && { remote: params.remote }),
      ...(params.checksRun !== undefined &&
        params.checksRun !== null && { checksRun: params.checksRun }),
      ...(params.publish !== undefined && params.publish !== null && { publish: params.publish }),
    },
    artifacts: params.artifacts,
    artifactPersistence: params.artifactPersistence,
    openQuestions: params.openQuestions,
    cost:
      params.costUsd === null
        ? { usd: null, basis: 'estimate' }
        : { usd: params.costUsd, basis: 'reported' },
    reason: resolved.reason,
  };
};

type StoredResultParams = {
  readonly value: unknown;
};

const isArtifactEntry = ({ value }: StoredResultParams): boolean =>
  isRecord(value) &&
  typeof value['id'] === 'string' &&
  typeof value['kind'] === 'string' &&
  typeof value['title'] === 'string' &&
  typeof value['revision'] === 'number' &&
  typeof value['contentHash'] === 'string';

const isQuestionEntry = ({ value }: StoredResultParams): boolean =>
  isRecord(value) && typeof value['questionId'] === 'string' && typeof value['text'] === 'string';

const isCheckEntry = ({ value }: StoredResultParams): boolean =>
  isRecord(value) &&
  typeof value['name'] === 'string' &&
  typeof value['status'] === 'string' &&
  typeof value['source'] === 'string';

const isFileEntry = ({ value }: StoredResultParams): boolean =>
  isRecord(value) && typeof value['path'] === 'string' && typeof value['ownership'] === 'string';

const isCost = ({ value }: StoredResultParams): boolean =>
  isRecord(value) &&
  (value['usd'] === null || typeof value['usd'] === 'number') &&
  typeof value['basis'] === 'string';

const isRouting = ({ value }: StoredResultParams): boolean =>
  isRecord(value) &&
  typeof value['provider'] === 'string' &&
  typeof value['model'] === 'string' &&
  typeof value['effort'] === 'string';

const isProcess = ({ value }: StoredResultParams): boolean =>
  isRecord(value) && typeof value['turns'] === 'number' && typeof value['durationMs'] === 'number';

const isDeclared = ({ value }: StoredResultParams): boolean =>
  isRecord(value) &&
  typeof value['summary'] === 'string' &&
  typeof value['completion'] === 'string';

const isReturned = ({ value }: StoredResultParams): boolean =>
  value === undefined ||
  (isRecord(value) &&
    (value['request'] === null || typeof value['request'] === 'string') &&
    (value['needs'] === null || isRecord(value['needs'])));

type EveryParams = StoredResultParams & {
  readonly check: (params: StoredResultParams) => boolean;
};

const isListOf = ({ value, check }: EveryParams): boolean =>
  Array.isArray(value) && value.every((entry: unknown) => check({ value: entry }));

const hasResultShape = ({ value }: StoredResultParams): boolean =>
  isRecord(value) &&
  value['schemaVersion'] === DELEGATION_RESULT_SCHEMA_VERSION &&
  typeof value['delegationId'] === 'string' &&
  typeof value['childAgentId'] === 'string' &&
  typeof value['role'] === 'string' &&
  typeof value['outcome'] === 'string' &&
  isRouting({ value: value['routing'] }) &&
  isProcess({ value: value['process'] }) &&
  isDeclared({ value: value['declared'] }) &&
  isReturned({ value: value['returned'] }) &&
  isCost({ value: value['cost'] }) &&
  isRecord(value['verified']) &&
  isListOf({ value: value['verified']['changedFiles'], check: isFileEntry }) &&
  isListOf({ value: value['verified']['checks'], check: isCheckEntry }) &&
  isListOf({ value: value['artifacts'], check: isArtifactEntry }) &&
  isListOf({ value: value['openQuestions'], check: isQuestionEntry });

export const storedResultOf = ({ value }: StoredResultParams): DelegationResultV1 | null =>
  [value].find((entry): entry is DelegationResultV1 => hasResultShape({ value: entry })) ?? null;

type PartialResultParams = {
  readonly entry: unknown;
};

export const renderPartialResult = ({ entry }: PartialResultParams): string => {
  if (!isRecord(entry) || typeof entry['delegationId'] !== 'string') {
    return '- the result of one agent could not be read';
  }
  const outcome = typeof entry['outcome'] === 'string' ? entry['outcome'] : 'unknown';
  const reason = typeof entry['reason'] === 'string' ? `, ${entry['reason']}` : '';
  return `- delegation ${entry['delegationId']}: ${outcome}${reason}`;
};

type RenderResultParams = {
  readonly result: DelegationResultV1;
  readonly label?: string;
};

const REMOTE_MOVED_TEXT = 'The branch changed online while this agent worked';
const REMOTE_UNKNOWN_TEXT =
  'Whether the branch changed online while this agent worked could not be read';

type RemoteLineParams = {
  readonly remote: ResultRemote;
};

const remoteLineOf = ({ remote }: RemoteLineParams): string | null => {
  const branch = remote.branch === null ? '' : ` (${remote.branch})`;
  if (remote.status === 'moved') {
    return `  ${REMOTE_MOVED_TEXT}${branch}`;
  }
  if (remote.status === 'unknown') {
    return `  ${REMOTE_UNKNOWN_TEXT}${branch}`;
  }
  return null;
};

export const renderDelegationResult = ({ result, label }: RenderResultParams): string => {
  const who =
    label === undefined
      ? `${result.role} ${result.childAgentId} (${result.delegationId})`
      : `${label} (${result.role} ${result.childAgentId}, ${result.delegationId})`;
  const lines: string[] = [
    `- ${who}: ${result.outcome}${result.reason === null ? '' : `, ${result.reason}`}`,
    `  ran on ${result.routing.provider} ${result.routing.model} ${result.routing.effort}; ${result.process.turns} turns, ${Math.round(result.process.durationMs / 1000)}s, cost ${result.cost.usd === null ? 'unknown' : `${result.cost.usd.toFixed(2)} USD (${result.cost.basis})`}`,
  ];
  if (result.reason === 'declined') {
    lines.push('  the user declined this step, so it never ran');
    return lines.join('\n');
  }
  if (result.declared.summary !== '') {
    lines.push(`  it said: ${oneLine({ text: result.declared.summary })}`);
  }
  const needs = result.returned?.needs ?? null;
  if (needs !== null && needs.kind === 'role') {
    lines.push(`  it asks for the ${needs.role} role`);
  }
  const request = result.returned?.request ?? null;
  if (request !== null) {
    lines.push(`  it asks: ${oneLine({ text: request })}`);
  }
  const need = result.reason === null ? undefined : REROUTE_NEED.get(result.reason);
  if (need !== undefined) {
    lines.push(rerouteHintOf({ role: result.role, need }));
  }
  if (result.declared.completion === 'none') {
    lines.push('  it did not close its work with the closing line');
  }
  if (result.verified.changedFiles.length > 0) {
    lines.push(
      `  changed files: ${result.verified.changedFiles
        .map((file) => `${file.path} (${file.ownership})`)
        .join(', ')}`,
    );
  }
  const remote = result.verified.remote;
  const remoteLine = remote === undefined ? null : remoteLineOf({ remote });
  if (remoteLine !== null) {
    lines.push(remoteLine);
  }
  for (const check of result.verified.checks) {
    lines.push(`  check ${check.name}: ${check.status} (${check.source})`);
  }
  const checksRun = result.verified.checksRun;
  if (checksRun !== undefined) {
    lines.push(`  ${checksTextOf({ run: checksRun, checks: result.verified.checks })}`);
  }
  const publish = result.verified.publish;
  if (publish !== undefined) {
    lines.push(`  ${publishTextOf({ publish })}`);
  }
  for (const artifact of result.artifacts) {
    const base = artifact.baseRevision === null ? '' : ` from version ${artifact.baseRevision}`;
    lines.push(
      `  artifact ${artifact.id} (${artifact.kind}) "${oneLine({ text: artifact.title })}" version ${artifact.revision}${base}, hash ${artifact.contentHash.slice(0, 12)}`,
    );
  }
  if (result.artifactPersistence === 'failed') {
    lines.push('  its artifact could not be saved');
  }
  if (result.artifactPersistence === 'not_written') {
    lines.push('  it wrote no report');
  }
  for (const question of result.openQuestions) {
    lines.push(`  open question ${question.questionId}: ${oneLine({ text: question.text })}`);
  }
  return lines.join('\n');
};
