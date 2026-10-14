import type { AutoOutcome } from '@goodboy/db';
import type { ChildClosing, ChildCompletion } from './closing';
import type { AutoDelegationRole } from './roles';

export const DELEGATION_RESULT_SCHEMA_VERSION = 1;
export const DELEGATION_SUMMARY_CHARS = 2_000;

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

export type ResultCheck = Readonly<{
  name: string;
  status: 'pass' | 'fail' | 'unknown';
  source: 'harness' | 'child_claim';
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
  verified: Readonly<{
    changedFiles: ReadonlyArray<ResultChangedFile>;
    checks: ReadonlyArray<ResultCheck>;
  }>;
  artifacts: ReadonlyArray<ResultArtifact>;
  artifactPersistence: 'ok' | 'failed' | 'not_applicable';
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
  if (isArtifactExpected && artifactPersistence === 'failed') {
    return { outcome: 'failed', reason: 'artifact_persistence_failed' };
  }
  if (completion === 'blocked') {
    return { outcome: 'blocked', reason: 'declared_blocked' };
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
  artifacts: ReadonlyArray<ResultArtifact>;
  artifactPersistence: DelegationResultV1['artifactPersistence'];
  isArtifactExpected: boolean;
  openQuestions: ReadonlyArray<ResultQuestion>;
  costUsd: number | null;
  reservedCeilingUsd: number;
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
    verified: { changedFiles: params.changedFiles, checks: params.checks },
    artifacts: params.artifacts,
    artifactPersistence: params.artifactPersistence,
    openQuestions: params.openQuestions,
    cost:
      params.costUsd === null
        ? { usd: params.reservedCeilingUsd, basis: 'reserved_ceiling' }
        : { usd: params.costUsd, basis: 'reported' },
    reason: resolved.reason,
  };
};

type RenderResultParams = {
  readonly result: DelegationResultV1;
};

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

export const renderDelegationResult = ({ result }: RenderResultParams): string => {
  const lines: string[] = [
    `- ${result.role} ${result.childAgentId} (${result.delegationId}): ${result.outcome}${result.reason === null ? '' : `, ${result.reason}`}`,
    `  ran on ${result.routing.provider} ${result.routing.model} ${result.routing.effort}; ${result.process.turns} turns, ${Math.round(result.process.durationMs / 1000)}s, cost ${result.cost.usd === null ? 'unknown' : result.cost.usd.toFixed(2)} USD (${result.cost.basis})`,
  ];
  if (result.declared.summary !== '') {
    lines.push(`  it said: ${oneLine(result.declared.summary)}`);
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
  for (const check of result.verified.checks) {
    lines.push(`  check ${check.name}: ${check.status} (${check.source})`);
  }
  for (const artifact of result.artifacts) {
    const base = artifact.baseRevision === null ? '' : ` from version ${artifact.baseRevision}`;
    lines.push(
      `  artifact ${artifact.id} (${artifact.kind}) "${oneLine(artifact.title)}" version ${artifact.revision}${base}, hash ${artifact.contentHash.slice(0, 12)}`,
    );
  }
  if (result.artifactPersistence === 'failed') {
    lines.push('  its artifact could not be saved');
  }
  for (const question of result.openQuestions) {
    lines.push(`  open question ${question.questionId}: ${oneLine(question.text)}`);
  }
  return lines.join('\n');
};
