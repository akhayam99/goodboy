import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { TerminalOwner, TerminalTabId } from '../../../shared/types/terminal';

const WORKSPACE_PREFIX = 'ws:';
const ORDINAL_SEPARATOR = '::t';

type OwnerParams = {
  readonly owner: TerminalOwner;
};

type IdParams = {
  readonly owner: TerminalOwner;
  readonly ordinal: number;
};

type ParseParams = {
  readonly id: string;
};

export type ParsedTerminalId = {
  readonly owner: TerminalOwner;
  readonly ordinal: number;
};

type SessionOwnerParams = {
  readonly sessionId: SessionId;
};

type WorkspaceOwnerParams = {
  readonly workspaceId: WorkspaceId;
};

type CharParams = {
  readonly char: string | undefined;
};

type PathParams = {
  readonly path: string;
};

type NullablePathParams = {
  readonly path: string | null;
};

export const sessionTerminalOwner = ({ sessionId }: SessionOwnerParams): TerminalOwner => ({
  kind: 'session',
  sessionId,
});

export const workspaceTerminalOwner = ({ workspaceId }: WorkspaceOwnerParams): TerminalOwner => ({
  kind: 'workspace',
  workspaceId,
});

export const terminalOwnerKey = ({ owner }: OwnerParams): string =>
  owner.kind === 'session' ? owner.sessionId : `${WORKSPACE_PREFIX}${owner.workspaceId}`;

export const terminalTabIdOf = ({ owner, ordinal }: IdParams): TerminalTabId =>
  `${terminalOwnerKey({ owner })}${ORDINAL_SEPARATOR}${ordinal}` as TerminalTabId;

export const parseTerminalId = ({ id }: ParseParams): ParsedTerminalId | null => {
  const separatorIndex = id.lastIndexOf(ORDINAL_SEPARATOR);
  if (separatorIndex <= 0) {
    return null;
  }
  const ordinal = Number.parseInt(id.slice(separatorIndex + ORDINAL_SEPARATOR.length), 10);
  if (Number.isNaN(ordinal) || ordinal < 1) {
    return null;
  }
  const head = id.slice(0, separatorIndex);
  if (head.startsWith(WORKSPACE_PREFIX)) {
    const workspaceId = head.slice(WORKSPACE_PREFIX.length);
    return workspaceId === ''
      ? null
      : { owner: workspaceTerminalOwner({ workspaceId: workspaceId as WorkspaceId }), ordinal };
  }
  return { owner: sessionTerminalOwner({ sessionId: head as SessionId }), ordinal };
};

const isSeparator = ({ char }: CharParams): boolean => char === '/' || char === '\\';

export const trimTrailingSeparators = ({ path }: PathParams): string => {
  let end = path.length;
  while (end > 0 && isSeparator({ char: path[end - 1] })) {
    end -= 1;
  }
  return path.slice(0, end);
};

export const folderName = ({ path }: NullablePathParams): string | null => {
  if (path === null) {
    return null;
  }
  const trimmed = trimTrailingSeparators({ path });
  const name = trimmed.slice(Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\')) + 1);
  return name === '' ? null : name;
};

export const DEFAULT_TERMINAL_NAME = 'shell';
