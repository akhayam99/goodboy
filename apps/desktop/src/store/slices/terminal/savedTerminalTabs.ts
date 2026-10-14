import type { MountId, ProjectId } from '@goodboy/types';
import type {
  TerminalOwner,
  TerminalSelection,
  TerminalTab,
  TerminalTabId,
} from '../../../shared/types/terminal';

export const SETTING_TERMINAL_TABS = 'terminal.tabs';

export type SavedTerminalTab = {
  readonly id: TerminalTabId;
  readonly owner: TerminalOwner;
  readonly title: string;
  readonly cwd: string | null;
  readonly projectId?: ProjectId;
  readonly mountId?: MountId;
  readonly status: 'running' | 'exited';
  readonly openError?: string;
};

export type SavedTerminalTabs = {
  readonly version: 1;
  readonly tabs: readonly SavedTerminalTab[];
  readonly active: Readonly<Record<string, TerminalTabId | null>>;
  readonly worktreeActive: Readonly<Record<string, TerminalTabId>>;
  readonly selection: TerminalSelection | null;
};

type SnapshotParams = {
  readonly tabs: Readonly<Record<string, readonly TerminalTab[]>>;
  readonly active: Readonly<Record<string, TerminalTabId | null>>;
  readonly worktreeActive: Readonly<Record<string, TerminalTabId>>;
  readonly selection: TerminalSelection | null;
};

export const snapshotTerminalTabs = ({
  tabs,
  active,
  worktreeActive,
  selection,
}: SnapshotParams): SavedTerminalTabs => ({
  version: 1,
  tabs: Object.values(tabs)
    .flat()
    .map((tab) => ({
      id: tab.id,
      owner: tab.owner,
      title: tab.title,
      cwd: tab.cwd,
      ...(tab.projectId === undefined ? {} : { projectId: tab.projectId }),
      ...(tab.mountId === undefined ? {} : { mountId: tab.mountId }),
      status: tab.status === 'exited' ? ('exited' as const) : ('running' as const),
      ...(tab.openError === undefined ? {} : { openError: tab.openError }),
    })),
  active,
  worktreeActive,
  selection,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOwner = (value: unknown): value is TerminalOwner => {
  if (!isRecord(value)) {
    return false;
  }
  if (value['kind'] === 'session') {
    return typeof value['sessionId'] === 'string';
  }
  return value['kind'] === 'workspace' && typeof value['workspaceId'] === 'string';
};

const isSavedTab = (value: unknown): value is SavedTerminalTab =>
  isRecord(value) &&
  typeof value['id'] === 'string' &&
  isOwner(value['owner']) &&
  typeof value['title'] === 'string' &&
  (value['cwd'] === null || typeof value['cwd'] === 'string') &&
  (value['status'] === 'running' || value['status'] === 'exited');

const isIdRecord = (value: unknown): value is Record<string, TerminalTabId | null> =>
  isRecord(value) && Object.values(value).every((id) => id === null || typeof id === 'string');

const isSelection = (value: unknown): value is TerminalSelection =>
  isRecord(value) &&
  (value['sessionId'] === null || typeof value['sessionId'] === 'string') &&
  (value['worktree'] === null || typeof value['worktree'] === 'string') &&
  (value['terminalId'] === null || typeof value['terminalId'] === 'string');

type ParseParams = {
  readonly raw: string;
};

export const parseSavedTerminalTabs = ({ raw }: ParseParams): SavedTerminalTabs | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed['version'] !== 1 || !Array.isArray(parsed['tabs'])) {
      return null;
    }
    const active = isIdRecord(parsed['active']) ? parsed['active'] : {};
    const worktreeActive = isIdRecord(parsed['worktreeActive'])
      ? Object.fromEntries(
          Object.entries(parsed['worktreeActive']).filter(
            (entry): entry is [string, TerminalTabId] => entry[1] !== null,
          ),
        )
      : {};
    return {
      version: 1,
      tabs: parsed['tabs'].filter(isSavedTab),
      active,
      worktreeActive,
      selection: isSelection(parsed['selection']) ? parsed['selection'] : null,
    };
  } catch {
    return null;
  }
};
