import { isAgentRole } from '../roles';
import type { OrchestratorDecision, OrchestratorStep } from './types';

const START_MARKER = '<<orchestrator>>';
const END_MARKER = '<</orchestrator>>';

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
  const lastBrace = raw.lastIndexOf('}');
  if (lastBrace <= contentStart) {
    return null;
  }
  return raw.slice(contentStart, lastBrace + 1).trim();
};

const parseStep = (value: unknown): OrchestratorStep | null => {
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
  return {
    name,
    role: role !== null && isAgentRole(role) ? role : 'custom',
    promptPrefix,
    ...(expectedOutput !== null && { expectedOutput }),
  };
};

export const parseOrchestratorDecision = (raw: string): OrchestratorDecision | null => {
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
  if (action === 'done' || action === 'blocked') {
    return { action, reason };
  }
  if (action !== 'next') {
    return null;
  }
  const step = parseStep(decision['step']);
  if (step === null) {
    return null;
  }
  return { action, reason, step };
};
