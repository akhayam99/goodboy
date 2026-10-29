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

const MAX_CLUSTER_AFTER = 8;

const MAX_CLUSTER_ID_LENGTH = 40;

const CLUSTER_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type ClusterOrder = {
  readonly id?: string;
  readonly after?: ReadonlyArray<string>;
};

type ClusterEntryParams = {
  readonly entry: Readonly<Record<string, unknown>>;
};

const readClusterOrder = ({ entry }: ClusterEntryParams): ClusterOrder => {
  const rawId = typeof entry['id'] === 'string' ? entry['id'].trim() : '';
  const hasValidId =
    rawId.length > 0 && rawId.length <= MAX_CLUSTER_ID_LENGTH && CLUSTER_ID_RE.test(rawId);
  const after = readClusterList({ value: entry['after'], limit: MAX_CLUSTER_AFTER });
  return {
    ...(hasValidId && { id: rawId }),
    ...(after !== null && { after }),
  };
};

type ClusterChecks = ClusterOrder & {
  readonly doneWhen?: ReadonlyArray<string>;
  readonly touches?: ReadonlyArray<string>;
};

export const readClusterChecks = (entry: Readonly<Record<string, unknown>>): ClusterChecks => {
  const doneWhen = readClusterList({ value: entry['doneWhen'], limit: MAX_CLUSTER_DONE_WHEN });
  const touches = readClusterList({ value: entry['touches'], limit: MAX_CLUSTER_TOUCHES });
  return {
    ...readClusterOrder({ entry }),
    ...(doneWhen !== null && { doneWhen }),
    ...(touches !== null && { touches }),
  };
};
