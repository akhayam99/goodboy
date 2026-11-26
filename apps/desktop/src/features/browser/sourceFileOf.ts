import type { MonitorProcess, PortRow } from '@goodboy/core/monitoring';
import type { SessionId } from '@goodboy/types';
import { isLoopbackHost } from './isLoopbackHost';

type Params = {
  readonly url: string;
  readonly line: number;
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<PortRow>;
  readonly processes: ReadonlyArray<MonitorProcess>;
};

type Served = {
  readonly port: number;
  readonly path: string;
};

type UrlParams = {
  readonly url: string;
};

type WorktreeParams = {
  readonly row: PortRow;
  readonly sessionId: SessionId;
};

type PathParams = {
  readonly path: string;
};

const TOOL_SEGMENTS: ReadonlySet<string> = new Set(['node_modules', '.vite']);

const withoutTrailingSlash = ({ path }: PathParams): string => {
  let end = path.length;
  while (end > 0 && path.charAt(end - 1) === '/') {
    end -= 1;
  }
  return path.slice(0, end);
};

const rawPathOf = ({ url }: UrlParams): string => {
  const scheme = url.indexOf('://');
  const slash = scheme < 0 ? -1 : url.indexOf('/', scheme + 3);
  if (slash < 0) {
    return '';
  }
  const rest = url.slice(slash);
  const query = rest.search(/[?#]/);
  return query < 0 ? rest : rest.slice(0, query);
};

const decodedOf = ({ path }: PathParams): string | null => {
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
};

const servedOf = ({ url }: UrlParams): Served | null => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!isLoopbackHost({ host: parsed.hostname })) {
      return null;
    }
    const defaultPort = parsed.protocol === 'https:' ? '443' : '80';
    const port = Number(parsed.port === '' ? defaultPort : parsed.port);
    const path = decodedOf({ path: rawPathOf({ url }) });
    if (!Number.isInteger(port) || port <= 0 || path === null) {
      return null;
    }
    return { port, path };
  } catch {
    return null;
  }
};

const worktreeOf = ({ row, sessionId }: WorktreeParams): string | null => {
  const { owner } = row;
  if (owner === null || owner.kind === 'project' || owner.kind === 'external') {
    return null;
  }
  if (owner.sessionId !== sessionId) {
    return null;
  }
  return owner.worktreePath;
};

const isOwnPath = ({ path }: PathParams): boolean => {
  const segments = path.split('/');
  return (
    path !== '' &&
    !path.startsWith('@') &&
    !segments.includes('..') &&
    !segments.includes('.') &&
    !segments.some((segment) => TOOL_SEGMENTS.has(segment))
  );
};

export const sourceFileOf = ({ url, line, sessionId, rows, processes }: Params): string | null => {
  const served = servedOf({ url });
  if (served === null || !Number.isInteger(line) || line <= 0) {
    return null;
  }
  const row = rows.find(
    (candidate) => candidate.port === served.port && candidate.state === 'listening',
  );
  const worktree = row === undefined ? null : worktreeOf({ row, sessionId });
  if (row === undefined || worktree === null) {
    return null;
  }
  const relative = served.path.replace(/^\/+/, '');
  if (!isOwnPath({ path: relative })) {
    return null;
  }
  const cwd = processes.find((process) => process.pid === row.pid)?.cwd ?? null;
  const root = withoutTrailingSlash({ path: worktree });
  const inside =
    cwd !== null && cwd.startsWith(`${root}/`)
      ? withoutTrailingSlash({ path: cwd.slice(root.length + 1) })
      : '';
  return `${inside === '' ? relative : `${inside}/${relative}`}:${line}`;
};
