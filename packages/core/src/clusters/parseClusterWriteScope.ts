import type { ClusterWriteScope } from '@goodboy/types';
import { CLUSTER_EXECUTION_CONTRACT_VERSION } from '@goodboy/types';

export type ClusterWriteScopeResult =
  | Readonly<{ kind: 'absent' }>
  | Readonly<{ kind: 'valid'; scope: ClusterWriteScope }>
  | Readonly<{ kind: 'invalid'; reason: string }>;

type ParseClusterWriteScopeParams = {
  readonly value: unknown;
  readonly label: string;
};

type EntryKind = 'file' | 'directory';

type EntryParams = {
  readonly raw: unknown;
  readonly kind: EntryKind;
  readonly label: string;
};

type EntryResult =
  Readonly<{ kind: 'valid'; path: string }> | Readonly<{ kind: 'invalid'; reason: string }>;

type ListParams = {
  readonly value: unknown;
  readonly kind: EntryKind;
  readonly label: string;
};

type ListResult =
  | Readonly<{ kind: 'valid'; paths: ReadonlyArray<string> }>
  | Readonly<{ kind: 'invalid'; reason: string }>;

type RejectParams = {
  readonly label: string;
  readonly path: string;
  readonly why: string;
};

const GLOB_CHARACTERS = /[*?[\]{}]/;

const DRIVE_PREFIX = /^[A-Za-z]:/;

const RESERVED_ROOTS: ReadonlySet<string> = new Set(['.goodboy']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const rejectPath = ({ label, path, why }: RejectParams): EntryResult => ({
  kind: 'invalid',
  reason: `cluster ${label} declares write scope path "${path}", which ${why}`,
});

const parseEntry = ({ raw, kind, label }: EntryParams): EntryResult => {
  if (typeof raw !== 'string') {
    return {
      kind: 'invalid',
      reason: `cluster ${label} declares a write scope ${kind} that is not a path`,
    };
  }
  const path = raw.trim();
  if (path.length === 0) {
    return { kind: 'invalid', reason: `cluster ${label} declares an empty write scope ${kind}` };
  }
  if (path.includes('\0') || path.includes('\\')) {
    return rejectPath({ label, path, why: 'holds a character a repository path cannot hold' });
  }
  if (path.startsWith('/') || path.startsWith('~') || DRIVE_PREFIX.test(path)) {
    return rejectPath({ label, path, why: 'is not relative to the repository root' });
  }
  if (GLOB_CHARACTERS.test(path)) {
    return rejectPath({ label, path, why: 'is a pattern, not an exact path' });
  }
  const isDirectoryForm = path.endsWith('/');
  if (kind === 'file' && isDirectoryForm) {
    return rejectPath({ label, path, why: 'names a directory, not a file' });
  }
  const bare = isDirectoryForm ? path.slice(0, -1) : path;
  const segments = bare.split('/');
  if (segments.some((segment) => segment.length === 0)) {
    return rejectPath({ label, path, why: 'has an empty path segment' });
  }
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return rejectPath({ label, path, why: 'uses a path alias' });
  }
  if (segments.some((segment) => segment.toLowerCase() === '.git')) {
    return rejectPath({ label, path, why: 'reaches into git metadata' });
  }
  const root = segments[0]?.toLowerCase() ?? '';
  if (RESERVED_ROOTS.has(root)) {
    return rejectPath({
      label,
      path,
      why: 'reaches into the private checkouts of the application',
    });
  }
  return { kind: 'valid', path: bare };
};

type ListLabelParams = {
  readonly kind: EntryKind;
};

const listLabel = ({ kind }: ListLabelParams): string =>
  kind === 'file' ? 'files' : 'directories';

const parseList = ({ value, kind, label }: ListParams): ListResult => {
  if (value === undefined) {
    return { kind: 'valid', paths: [] };
  }
  if (!Array.isArray(value)) {
    return {
      kind: 'invalid',
      reason: `cluster ${label} declares write scope ${listLabel({ kind })} that are not an array`,
    };
  }
  const paths = new Set<string>();
  for (const raw of value) {
    const entry = parseEntry({ raw, kind, label });
    if (entry.kind === 'invalid') {
      return entry;
    }
    paths.add(entry.path);
  }
  return { kind: 'valid', paths: [...paths].sort() };
};

export const parseClusterWriteScope = ({
  value,
  label,
}: ParseClusterWriteScopeParams): ClusterWriteScopeResult => {
  if (value === undefined) {
    return { kind: 'absent' };
  }
  if (!isRecord(value)) {
    return {
      kind: 'invalid',
      reason: `cluster ${label} declares a write scope that is not an object`,
    };
  }
  const version = value['version'];
  if (version === undefined) {
    return {
      kind: 'invalid',
      reason: `cluster ${label} declares a write scope without a contract version`,
    };
  }
  if (version !== CLUSTER_EXECUTION_CONTRACT_VERSION) {
    return {
      kind: 'invalid',
      reason: `cluster ${label} declares write scope contract version ${String(version)}; only version ${CLUSTER_EXECUTION_CONTRACT_VERSION} is supported`,
    };
  }
  const files = parseList({ value: value['files'], kind: 'file', label });
  if (files.kind === 'invalid') {
    return files;
  }
  const directories = parseList({ value: value['directories'], kind: 'directory', label });
  if (directories.kind === 'invalid') {
    return directories;
  }
  return {
    kind: 'valid',
    scope: {
      version: CLUSTER_EXECUTION_CONTRACT_VERSION,
      files: files.paths,
      directories: directories.paths,
    },
  };
};

type HasContractParams = {
  readonly nodes: ReadonlyArray<Readonly<{ writeScope?: ClusterWriteScope }>>;
};

export const hasClusterExecutionContract = ({ nodes }: HasContractParams): boolean =>
  nodes.some((node) => node.writeScope !== undefined);
