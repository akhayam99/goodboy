import type {
  ArtifactKind,
  ImplementationCluster,
  PlanArtifactMetadata,
  ReportArtifactMetadata,
  WireframeArtifactMetadata,
} from '@goodboy/types';
import {
  normalizeClusterGraph,
  parseClusterWriteScope,
  resolvePlanClusterRole,
  unsupportedClusterRoleReason,
} from '../clusters';
import { ARTIFACT_MAX_BYTES, ARTIFACT_SCHEMA_VERSION, extractArtifactBlocks } from './grammar';
import type { ArtifactCaptureError, ArtifactCaptureResult, ParsedArtifact } from './types';
import { parseWireframeSource, type WireframeIssue } from './wireframe';

const KINDS: ReadonlySet<string> = new Set<ArtifactKind>(['plan', 'report', 'wireframe']);

const MAX_TITLE_LENGTH = 300;

const STRICT_VERSION_RE = /^[0-9]{1,9}$/;

const DEFAULT_REPORT_TYPE = 'session-summary';

const MAX_REPORTED_WIREFRAME_ISSUES = 3;

const fail = (code: ArtifactCaptureError['code'], message: string): ArtifactCaptureError => ({
  status: 'error',
  code,
  message,
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

const envelopeVersion = (raw: string | undefined): number | null => {
  if (raw === undefined || !STRICT_VERSION_RE.test(raw)) {
    return null;
  }
  return Number.parseInt(raw, 10);
};

type PlanMetadataResult =
  | Readonly<{ kind: 'valid'; metadata: PlanArtifactMetadata }>
  | Readonly<{ kind: 'invalid'; reason: string }>;

const hasClusterBody = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value['title'] === 'string' &&
  value['title'].trim().length > 0 &&
  typeof value['instructions'] === 'string' &&
  value['instructions'].trim().length > 0;

const toCluster = (
  value: Readonly<Record<string, unknown>>,
):
  | Readonly<{ kind: 'valid'; cluster: ImplementationCluster }>
  | Readonly<{
      kind: 'invalid';
      reason: string;
    }> => {
  const title = String(value['title']).trim();
  const label = `"${title}"`;
  const rawId = value['id'];
  const id = typeof rawId === 'string' ? rawId.trim() : '';
  const rawDependsOn = value['dependsOn'];
  if (rawDependsOn !== undefined && !Array.isArray(rawDependsOn)) {
    return { kind: 'invalid', reason: `cluster ${label} declares dependsOn that is not an array` };
  }
  const dependsOn = Array.isArray(rawDependsOn)
    ? rawDependsOn.map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    : undefined;
  const rawExpected = value['expectedOutput'];
  const expectedOutput = typeof rawExpected === 'string' ? rawExpected.trim() : '';
  const role = resolvePlanClusterRole({ role: value['role'] });
  if (role.kind === 'invalid') {
    return {
      kind: 'invalid',
      reason: unsupportedClusterRoleReason({ label, declared: role.declared }),
    };
  }
  const writeScope = parseClusterWriteScope({ value: value['writeScope'], label });
  if (writeScope.kind === 'invalid') {
    return { kind: 'invalid', reason: writeScope.reason };
  }
  return {
    kind: 'valid',
    cluster: {
      ...(id.length > 0 && { id }),
      title,
      instructions: String(value['instructions']).trim(),
      ...(value['role'] !== undefined && { role: role.role }),
      ...(dependsOn !== undefined && { dependsOn }),
      ...(expectedOutput.length > 0 && { expectedOutput }),
      ...(writeScope.kind === 'valid' && { writeScope: writeScope.scope }),
    },
  };
};

const planMetadata = (value: unknown): PlanMetadataResult => {
  if (!isRecord(value)) {
    return { kind: 'valid', metadata: {} };
  }
  const clusters = value['clusters'];
  if (!Array.isArray(clusters)) {
    return { kind: 'valid', metadata: {} };
  }
  const parsed: ImplementationCluster[] = [];
  for (const entry of clusters) {
    if (!isRecord(entry) || !hasClusterBody(entry)) {
      continue;
    }
    const cluster = toCluster(entry);
    if (cluster.kind === 'invalid') {
      return { kind: 'invalid', reason: cluster.reason };
    }
    parsed.push(cluster.cluster);
  }
  if (parsed.length === 0) {
    return { kind: 'valid', metadata: {} };
  }
  const normalized = normalizeClusterGraph({ clusters: parsed });
  if (normalized.kind === 'invalid') {
    return { kind: 'invalid', reason: normalized.reason };
  }
  return { kind: 'valid', metadata: { clusters: parsed } };
};

const reportMetadata = (value: unknown): ReportArtifactMetadata => {
  const raw = isRecord(value) ? value['reportType'] : null;
  const reportType = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  return { reportType: reportType ?? DEFAULT_REPORT_TYPE };
};

const wireframeMetadata = (value: unknown): WireframeArtifactMetadata => {
  const fidelityRaw = isRecord(value) ? value['fidelity'] : null;
  const profileRaw = isRecord(value) ? value['designProfile'] : null;
  return {
    fidelity: fidelityRaw === 'high' ? 'high' : 'low',
    designProfile: isRecord(profileRaw) ? profileRaw : {},
  };
};

const describeWireframeIssues = ({
  issues,
}: {
  readonly issues: ReadonlyArray<WireframeIssue>;
}): string => {
  const head = issues
    .slice(0, MAX_REPORTED_WIREFRAME_ISSUES)
    .map((issue) => (issue.path.length === 0 ? issue.message : `${issue.path}: ${issue.message}`))
    .join('; ');
  const rest = issues.length - MAX_REPORTED_WIREFRAME_ISSUES;
  return rest > 0 ? `${head}; and ${rest} more` : head;
};

const markdownContent = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const jsonContent = (value: unknown): string | null => {
  if (isRecord(value)) {
    return JSON.stringify(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? JSON.stringify(parsed) : null;
  } catch {
    return null;
  }
};

export const parseArtifactEnvelope = (assistantText: string): ArtifactCaptureResult => {
  const blocks = extractArtifactBlocks(assistantText);
  if (blocks.length === 0) {
    return { status: 'none' };
  }
  if (blocks.some((block) => !block.complete)) {
    return fail('truncated', 'the artifact block never reached its <</artifact>> closing line');
  }
  if (blocks.length > 1) {
    return fail(
      'multiple_blocks',
      `${blocks.length} artifact blocks in one turn, only one is captured per turn`,
    );
  }
  const block = blocks[0]!;
  if (byteLength(block.body) > ARTIFACT_MAX_BYTES) {
    return fail('too_large', `the artifact body is over the ${ARTIFACT_MAX_BYTES} byte limit`);
  }
  const version = envelopeVersion(block.attrs['v']);
  if (version !== ARTIFACT_SCHEMA_VERSION) {
    return fail(
      'unsupported_version',
      `artifact contract v=${block.attrs['v'] ?? 'missing'} is not supported, use v=${ARTIFACT_SCHEMA_VERSION}`,
    );
  }
  const kindRaw = (block.attrs['kind'] ?? '').toLowerCase();
  if (!KINDS.has(kindRaw)) {
    return fail('unknown_kind', `artifact kind "${kindRaw}" is not one of plan, report, wireframe`);
  }
  const kind = kindRaw as ArtifactKind;

  let payload: unknown;
  try {
    payload = JSON.parse(block.body);
  } catch {
    return fail('invalid_json', 'the artifact body is not valid JSON');
  }
  if (!isRecord(payload)) {
    return fail('invalid_json', 'the artifact body must be a JSON object');
  }

  const titleRaw = payload['title'];
  const title = typeof titleRaw === 'string' ? titleRaw.trim().slice(0, MAX_TITLE_LENGTH) : '';
  if (title.length === 0) {
    return fail('invalid_payload', 'the artifact payload needs a non-empty title');
  }

  const expectedFormat = kind === 'wireframe' ? 'json' : 'markdown';
  const format = payload['format'];
  if (format !== undefined && format !== expectedFormat) {
    return fail(
      'invalid_format',
      `artifact kind ${kind} must use format ${expectedFormat}, got ${String(format)}`,
    );
  }

  if (kind === 'wireframe') {
    const sourceText = jsonContent(payload['content']);
    if (sourceText === null) {
      return fail('invalid_payload', 'the wireframe content must be a JSON object');
    }
    const validated = parseWireframeSource({ source: sourceText });
    if (validated.status === 'invalid') {
      return fail(
        'invalid_payload',
        `the wireframe document does not match the contract: ${describeWireframeIssues({ issues: validated.issues })}`,
      );
    }
    const artifact: ParsedArtifact = {
      kind,
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      title,
      sourceFormat: 'json',
      sourceText,
      metadata: wireframeMetadata(payload['metadata']),
      origin: 'envelope',
    };
    return { status: 'captured', artifact };
  }

  const sourceText = markdownContent(payload['content']);
  if (sourceText === null) {
    return fail('invalid_payload', `the ${kind} content must be a non-empty markdown string`);
  }
  const plan = planMetadata(payload['metadata']);
  if (kind === 'plan' && plan.kind === 'invalid') {
    return fail('invalid_payload', `the plan clusters are not a valid graph: ${plan.reason}`);
  }
  const artifact: ParsedArtifact =
    kind === 'plan'
      ? {
          kind: 'plan',
          schemaVersion: ARTIFACT_SCHEMA_VERSION,
          title,
          sourceFormat: 'markdown',
          sourceText,
          metadata: plan.kind === 'valid' ? plan.metadata : {},
          origin: 'envelope',
        }
      : {
          kind: 'report',
          schemaVersion: ARTIFACT_SCHEMA_VERSION,
          title,
          sourceFormat: 'markdown',
          sourceText,
          metadata: reportMetadata(payload['metadata']),
          origin: 'envelope',
        };
  return { status: 'captured', artifact };
};
