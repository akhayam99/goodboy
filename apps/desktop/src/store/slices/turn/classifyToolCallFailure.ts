type ToolCallFailureClassification =
  { readonly kind: 'git_index_lock' } | { readonly kind: 'other' };

type Params = {
  readonly output: unknown;
};

const GIT_INDEX_LOCK_PATTERNS: ReadonlyArray<RegExp> = [
  /Another git process seems to be running/i,
  /index\.lock['"]?:\s*File exists/i,
];

const hasAggregatedOutput = (value: unknown): value is { aggregated_output: string } => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('aggregated_output' in value)) {
    return false;
  }
  return typeof (value as Record<string, unknown>).aggregated_output === 'string';
};

const normalizeToolCallOutput = (output: unknown): string => {
  if (typeof output === 'string') {
    return output;
  }
  if (hasAggregatedOutput(output)) {
    return output.aggregated_output;
  }
  return JSON.stringify(output);
};

export const classifyToolCallFailure = ({ output }: Params): ToolCallFailureClassification => {
  const normalized = normalizeToolCallOutput(output);
  if (GIT_INDEX_LOCK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { kind: 'git_index_lock' };
  }
  return { kind: 'other' };
};

export const toolCallFailureMessage = (
  classification: ToolCallFailureClassification,
): string | null => {
  switch (classification.kind) {
    case 'git_index_lock':
      return 'Git could not commit because another process is holding .git/index.lock. Close any other Git client, editor, or terminal running a commit in this repository, then retry.';
    case 'other':
      return null;
    default: {
      const exhaustive: never = classification;
      return exhaustive;
    }
  }
};
