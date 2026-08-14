import type { RunSummary } from './types';

export type StructuredRunSummary = Extract<RunSummary, { readonly kind: 'structured' }>;

const stringList = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry !== '')
    : [];

export const structuredRunSummary = (value: unknown): StructuredRunSummary | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record['done']) && !Array.isArray(record['left'])) {
    return null;
  }
  return {
    kind: 'structured',
    done: stringList(record['done']),
    left: stringList(record['left']),
  };
};

export const serializeRunSummary = (summary: RunSummary): string => {
  if (summary.kind === 'text') {
    return summary.text.trim();
  }
  if (summary.done.length === 0 && summary.left.length === 0) {
    return '';
  }
  return JSON.stringify({ done: summary.done, left: summary.left });
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
