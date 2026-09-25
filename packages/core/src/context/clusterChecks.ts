export const MAX_CLUSTER_DONE_WHEN = 4;

export const MAX_CLUSTER_TOUCHES = 12;

type ReadClusterListParams = {
  readonly value: unknown;
  readonly limit: number;
};

export const readClusterList = ({
  value,
  limit,
}: ReadClusterListParams): ReadonlyArray<string> | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }
    const item = entry.trim();
    if (item.length === 0 || seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item);
    if (out.length === limit) {
      break;
    }
  }
  return out.length > 0 ? out : null;
};

type ClusterChecks = {
  readonly doneWhen?: ReadonlyArray<string>;
  readonly touches?: ReadonlyArray<string>;
};

export const readClusterChecks = (entry: Readonly<Record<string, unknown>>): ClusterChecks => {
  const doneWhen = readClusterList({ value: entry['doneWhen'], limit: MAX_CLUSTER_DONE_WHEN });
  const touches = readClusterList({ value: entry['touches'], limit: MAX_CLUSTER_TOUCHES });
  return {
    ...(doneWhen !== null && { doneWhen }),
    ...(touches !== null && { touches }),
  };
};
