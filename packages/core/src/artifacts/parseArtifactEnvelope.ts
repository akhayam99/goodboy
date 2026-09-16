import type {
  ArtifactKind,
  ImplementationCluster,
  PlanArtifactMetadata,
  ReportArtifactMetadata,
  WireframeArtifactMetadata,
} from '@goodboy/types';
import { ARTIFACT_MAX_BYTES, ARTIFACT_SCHEMA_VERSION, extractArtifactBlocks } from './grammar';
import type { ArtifactCaptureError, ArtifactCaptureResult, ParsedArtifact } from './types';

const KINDS: ReadonlySet<string> = new Set<ArtifactKind>(['plan', 'report', 'wireframe']);

const MAX_TITLE_LENGTH = 300;

const STRICT_VERSION_RE = /^[0-9]{1,9}$/;

const DEFAULT_REPORT_TYPE = 'session-summary';

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

const isCluster = (value: unknown): value is ImplementationCluster =>
  isRecord(value) &&
  typeof value['title'] === 'string' &&
  typeof value['instructions'] === 'string';

const planMetadata = (value: unknown): PlanArtifactMetadata => {
  if (!isRecord(value)) {
    return {};
  }
  const clusters = value['clusters'];
  if (!Array.isArray(clusters)) {
    return {};
  }
  const valid = clusters.filter(isCluster);
  return valid.length > 0 ? { clusters: valid } : {};
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
  const artifact: ParsedArtifact =
    kind === 'plan'
      ? {
          kind: 'plan',
          schemaVersion: ARTIFACT_SCHEMA_VERSION,
          title,
          sourceFormat: 'markdown',
          sourceText,
          metadata: planMetadata(payload['metadata']),
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
