import type { MonitorProcess, PortRow } from '@goodboy/core/monitoring';
import type { SessionId } from '@goodboy/types';
import { isLoopbackHost } from './isLoopbackHost';
import type { BrowserPickedElement } from './types';

type Params = {
  readonly element: BrowserPickedElement;
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<PortRow>;
  readonly processes: ReadonlyArray<MonitorProcess>;
};

type PortParams = {
  readonly url: string;
};

type WorktreeParams = {
  readonly row: PortRow;
  readonly sessionId: SessionId;
};

type PathParams = {
  readonly path: string;
};

const withoutTrailingSlash = ({ path }: PathParams): string => {
  let end = path.length;
  while (end > 0 && path.charAt(end - 1) === '/') {
    end -= 1;
  }
  return path.slice(0, end);
};

const portOf = ({ url }: PortParams): number | null => {
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
    return Number.isInteger(port) && port > 0 ? port : null;
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

export const elementFileOf = ({ element, sessionId, rows, processes }: Params): string | null => {
  const { source } = element;
  const port = portOf({ url: element.url });
  if (source === null || port === null) {
    return null;
  }
  const row = rows.find((candidate) => candidate.port === port && candidate.state === 'listening');
  const worktree = row === undefined ? null : worktreeOf({ row, sessionId });
  if (row === undefined || worktree === null) {
    return null;
  }
  const relative = source.path.replace(/^\/+/, '');
  if (relative === '' || relative.split('/').includes('..')) {
    return null;
  }
  const cwd = processes.find((process) => process.pid === row.pid)?.cwd ?? null;
  const root = withoutTrailingSlash({ path: worktree });
  const inside =
    cwd !== null && cwd.startsWith(`${root}/`)
      ? withoutTrailingSlash({ path: cwd.slice(root.length + 1) })
      : '';
  return `${inside === '' ? relative : `${inside}/${relative}`}:${source.line}`;
};
