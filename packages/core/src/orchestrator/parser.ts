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

const parseStep = (value: unknown): OrchestratorStep | null => {
  const step = asRecord(value);
  if (step === null) {
    return null;
  }
  const name = nonEmptyString(step['name']);
  const role = nonEmptyString(step['role']);
  const promptPrefix = nonEmptyString(step['promptPrefix']);
  const expectedOutput = nonEmptyString(step['expectedOutput']);
  if (
    name === null ||
    role === null ||
    !isAgentRole(role) ||
    promptPrefix === null ||
    expectedOutput === null
  ) {
    return null;
  }
  return { name, role, promptPrefix, expectedOutput };
};

export const parseOrchestratorDecision = (raw: string): OrchestratorDecision | null => {
  const start = raw.indexOf(START_MARKER);
  if (start < 0) {
    return null;
  }
  const contentStart = start + START_MARKER.length;
  const end = raw.indexOf(END_MARKER, contentStart);
  if (end < 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(contentStart, end).trim());
  } catch {
    return null;
  }
  const decision = asRecord(parsed);
  if (decision === null) {
    return null;
  }
  const action = decision['action'];
  const reason = nonEmptyString(decision['reason']);
  if (reason === null) {
    return null;
  }
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
