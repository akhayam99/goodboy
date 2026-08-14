import type { ModelEffort, ProviderId } from '@goodboy/types';
import { providerEffortLevels } from '../providers/providerEffortLevels';
import { resolveStoredModelSelection } from '../providers/resolveStoredModelSelection';
import { isAgentRole } from '../roles';
import { structuredRunSummary } from './runSummary';
import type { OrchestratorDecision, OrchestratorStep, RunSummary } from './types';

const START_MARKER = '<<orchestrator>>';
const END_MARKER = '<</orchestrator>>';
const SUMMARY_START_MARKER = '<<run-summary>>';
const SUMMARY_END_MARKER = '<</run-summary>>';

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const nonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return value.trim();
};

const stripCodeFences = (value: string): string =>
  value
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

const escapeControlCharsInStrings = (value: string): string => {
  let result = '';
  let inString = false;
  let escaped = false;
  for (const char of value) {
    if (inString && !escaped && (char === '\n' || char === '\r' || char === '\t')) {
      result += char === '\n' ? '\\n' : char === '\r' ? '\\r' : '\\t';
      continue;
    }
    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      inString = !inString;
    }
    result += char;
  }
  return result;
};

const parseJson = (value: string): unknown | null => {
  const candidate = stripCodeFences(value);
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(escapeControlCharsInStrings(candidate));
    } catch {
      return null;
    }
  }
};

const decisionSlice = (raw: string): string | null => {
  const start = raw.indexOf(START_MARKER);
  if (start < 0) {
    return null;
  }
  const contentStart = start + START_MARKER.length;
  const end = raw.indexOf(END_MARKER, contentStart);
  if (end >= 0) {
    return raw.slice(contentStart, end).trim();
  }
  const summaryStart = raw.indexOf(SUMMARY_START_MARKER, contentStart);
  const searchEnd = summaryStart >= 0 ? summaryStart : raw.length;
  const lastBrace = raw.lastIndexOf('}', searchEnd - 1);
  if (lastBrace <= contentStart) {
    return null;
  }
  return raw.slice(contentStart, lastBrace + 1).trim();
};

const runSummarySlice = (raw: string): string | null => {
  const start = raw.indexOf(SUMMARY_START_MARKER);
  if (start < 0) {
    return null;
  }
  const contentStart = start + SUMMARY_START_MARKER.length;
  const end = raw.indexOf(SUMMARY_END_MARKER, contentStart);
  if (end < 0) {
    return null;
  }
  return nonEmptyString(raw.slice(contentStart, end));
};

const parseRunSummary = (raw: string): RunSummary | null => {
  const slice = runSummarySlice(raw);
  if (slice === null) {
    return null;
  }
  return structuredRunSummary(parseJson(slice)) ?? { kind: 'text', text: slice };
};

type ModelParams = {
  readonly provider: ProviderId;
  readonly id: string | null;
};

const validModel = ({ provider, id }: ModelParams): string | null => {
  if (id === null) {
    return null;
  }
  const stored = resolveStoredModelSelection({ provider, id });
  if (stored.report?.kind === 'unknown') {
    return null;
  }
  return stored.selection.key;
};

type EffortParams = {
  readonly provider: ProviderId;
  readonly model: string | null;
  readonly level: string | null;
};

const validEffort = ({ provider, model, level }: EffortParams): ModelEffort | null => {
  if (level === null) {
    return null;
  }
  const ladder = providerEffortLevels({ provider, ...(model !== null && { model }) });
  return ladder.find((candidate) => candidate === level) ?? null;
};

type StepParams = {
  readonly value: unknown;
  readonly provider: ProviderId;
};

const parseStep = ({ value, provider }: StepParams): OrchestratorStep | null => {
  const step = asRecord(value);
  if (step === null) {
    return null;
  }
  const name = nonEmptyString(step['name']);
  const role = nonEmptyString(step['role']);
  const promptPrefix = nonEmptyString(step['promptPrefix']);
  const expectedOutput = nonEmptyString(step['expectedOutput']);
  if (name === null || promptPrefix === null) {
    return null;
  }
  const model = validModel({ provider, id: nonEmptyString(step['model']) });
  const effort = validEffort({ provider, model, level: nonEmptyString(step['effort']) });
  return {
    name,
    role: role !== null && isAgentRole(role) ? role : 'custom',
    promptPrefix,
    ...(expectedOutput !== null && { expectedOutput }),
    ...(model !== null && { model }),
    ...(effort !== null && { effort }),
  };
};

type Params = {
  readonly raw: string;
  readonly provider: ProviderId;
};

export const parseOrchestratorDecision = ({
  raw,
  provider,
}: Params): OrchestratorDecision | null => {
  const slice = decisionSlice(raw);
  if (slice === null) {
    return null;
  }
  const decision = asRecord(parseJson(slice));
  if (decision === null) {
    return null;
  }
  const action = decision['action'];
  const reason = nonEmptyString(decision['reason']) ?? '';
  const summary = parseRunSummary(raw);
  const runSummary = summary === null ? {} : { runSummary: summary };
  if (action === 'done' || action === 'blocked') {
    return { action, reason, ...runSummary };
  }
  if (action !== 'next') {
    return null;
  }
  const step = parseStep({ value: decision['step'], provider });
  if (step === null) {
    return null;
  }
  return { action, reason, ...runSummary, step };
};
