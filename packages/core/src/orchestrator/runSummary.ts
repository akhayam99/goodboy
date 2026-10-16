import type { AgentRole } from '@goodboy/types';
import { isAgentRole } from '../roles';
import type { RunSummary } from './types';

export type StructuredRunSummary = Extract<RunSummary, { readonly kind: 'structured' }>;

type LeftEntry = {
  readonly text: string;
  readonly role: AgentRole | null;
};

const stringList = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry !== '')
    : [];

type ValueParams = {
  readonly value: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const leftEntryOf = ({ value }: ValueParams): LeftEntry | null => {
  if (typeof value === 'string') {
    const text = value.trim();
    return text === '' ? null : { text, role: null };
  }
  if (!isRecord(value)) {
    return null;
  }
  const text = typeof value['text'] === 'string' ? value['text'].trim() : '';
  if (text === '') {
    return null;
  }
  const role = typeof value['role'] === 'string' ? value['role'].trim().toLowerCase() : '';
  return { text, role: isAgentRole(role) ? role : null };
};

const leftEntries = ({ value }: ValueParams): ReadonlyArray<LeftEntry> =>
  Array.isArray(value)
    ? value.flatMap((entry: unknown) => {
        const parsed = leftEntryOf({ value: entry });
        return parsed === null ? [] : [parsed];
      })
    : [];

export const structuredRunSummary = (value: unknown): StructuredRunSummary | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (!Array.isArray(value['done']) && !Array.isArray(value['left'])) {
    return null;
  }
  const left = leftEntries({ value: value['left'] });
  const leftRoles: Partial<Record<string, AgentRole>> = {};
  for (const entry of left) {
    if (entry.role !== null) {
      leftRoles[entry.text] = entry.role;
    }
  }
  return {
    kind: 'structured',
    done: stringList(value['done']),
    left: left.map((entry) => entry.text),
    leftRoles,
  };
};

export const serializeRunSummary = (summary: RunSummary): string => {
  if (summary.kind === 'text') {
    return summary.text.trim();
  }
  if (summary.done.length === 0 && summary.left.length === 0) {
    return '';
  }
  const left = summary.left.map((text) => {
    const role = summary.leftRoles[text];
    return role === undefined ? text : { text, role };
  });
  return JSON.stringify({ done: summary.done, left });
};

export const parseRunSummaryText = (text: string): StructuredRunSummary | null => {
  if (!text.startsWith('{')) {
    return null;
  }
  try {
    return structuredRunSummary(JSON.parse(text));
  } catch {
    return null;
  }
};
