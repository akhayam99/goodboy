import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { DOCK_GRID_CAP } from '@goodboy/ui';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import type { SessionFace } from '../../session-view/types';
import type {
  DrawerContent,
  DrawerFocus,
  DrawerGrid,
  DrawerGridSplits,
  DrawerGridWidths,
  OpenDrawer,
  PullRequestDrawerTab,
  WorkspaceToolKind,
} from '../state';

const STORED_DOCK_GRID_VERSION = 1;

const TOOL_KINDS: ReadonlyArray<WorkspaceToolKind> = ['terminal', 'browser', 'monitoring'];

const PR_TABS: ReadonlyArray<PullRequestDrawerTab> = ['checks', 'conversation'];

const DESK_DETAIL_CAP = 2;

export type DeskDetailEntry = Extract<OpenDrawer, { readonly kind: 'transcript' | 'pull-request' }>;

type StoredDetail =
  | { readonly kind: 'transcript'; readonly agentId: AgentId }
  | {
      readonly kind: 'pull-request';
      readonly mountId: MountId;
      readonly tab: PullRequestDrawerTab;
    };

type GridParams = {
  readonly grid: DrawerGrid;
  readonly face?: SessionFace;
  readonly detail?: ReadonlyArray<OpenDrawer>;
};

type DetailParams = {
  readonly detail: ReadonlyArray<OpenDrawer>;
};

type DetailValueParams = {
  readonly value: unknown;
  readonly sessionId: SessionId;
};

type DeskDetailParams = {
  readonly raw: string;
  readonly sessionId: SessionId;
};

type RawParams = {
  readonly raw: string;
};

type ValueParams = {
  readonly value: unknown;
};

type EntryParams = {
  readonly kind: WorkspaceToolKind;
  readonly sessionId: SessionId | null;
  readonly payload: unknown;
};

type KindsParams = ValueParams & {
  readonly kinds: ReadonlyArray<DrawerContent['kind']>;
};

const toolKindOf = ({ value }: ValueParams): WorkspaceToolKind | null =>
  TOOL_KINDS.find((kind) => kind === value) ?? null;

const storedSessionIdOf = ({ value }: ValueParams): SessionId | null | undefined => {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' && value !== '' ? brandId<SessionId>({ value }) : undefined;
};

const storedEntryOf = ({ kind, sessionId, payload }: EntryParams): OpenDrawer | null => {
  if (kind === 'terminal') {
    if (!isRecord(payload) || typeof payload.terminalId !== 'string') {
      return null;
    }
    const terminalId = brandId<TerminalTabId>({ value: payload.terminalId });
    return sessionId === null
      ? { kind, sessionId, payload: { terminalId } }
      : { kind, sessionId, payload: { terminalId } };
  }
  if (payload !== null) {
    return null;
  }
  return sessionId === null ? { kind, sessionId, payload } : { kind, sessionId, payload };
};

const panelOf = ({ value }: ValueParams): OpenDrawer | null => {
  if (!isRecord(value)) {
    return null;
  }
  const kind = toolKindOf({ value: value.kind });
  const sessionId = storedSessionIdOf({ value: value.sessionId });
  if (kind === null || sessionId === undefined) {
    return null;
  }
  return storedEntryOf({ kind, sessionId, payload: value.payload ?? null });
};

const columnsOf = ({ value }: ValueParams): DrawerGrid['columns'] | null => {
  if (!Array.isArray(value) || value.length > DOCK_GRID_CAP.columns) {
    return null;
  }
  const columns: Array<ReadonlyArray<OpenDrawer>> = [];
  for (const column of value) {
    if (!Array.isArray(column) || column.length === 0 || column.length > DOCK_GRID_CAP.rows) {
      return null;
    }
    const panels = column.map((panel) => panelOf({ value: panel }));
    if (panels.some((panel) => panel === null)) {
      return null;
    }
    columns.push(panels.filter((panel): panel is OpenDrawer => panel !== null));
  }
  const kinds = columns.flat().map((panel) => panel.kind);
  return new Set(kinds).size === kinds.length ? columns : null;
};

const usedOf = ({ value, kinds }: KindsParams): DrawerGrid['used'] => {
  const listed: ReadonlyArray<unknown> = Array.isArray(value) ? value : [];
  const known = listed.flatMap((item) => kinds.filter((kind) => kind === item));
  const used = known.filter((kind, index) => known.indexOf(kind) === index);
  return [...kinds.filter((kind) => !used.includes(kind)), ...used];
};

const storedFocusOf = ({ value, kinds }: KindsParams): DrawerFocus => {
  if (!isRecord(value)) {
    return { at: 'page' };
  }
  if (value.at === 'detail') {
    return { at: 'detail' };
  }
  const kind = kinds.find((known) => known === value.kind);
  return value.at === 'tool' && kind !== undefined ? { at: 'tool', kind } : { at: 'page' };
};

const widthsOf = ({ value }: ValueParams): DrawerGridWidths => {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    TOOL_KINDS.flatMap((kind) => {
      const width = value[kind];
      return typeof width === 'number' && Number.isFinite(width) && width > 0
        ? [[kind, Math.round(width)] as const]
        : [];
    }),
  );
};

const isSplitKey = ({ value }: ValueParams): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  const kinds = value.split('/');
  return kinds.length === 2 && kinds.every((kind) => toolKindOf({ value: kind }) !== null);
};

const splitsOf = ({ value }: ValueParams): DrawerGridSplits => {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, share]) =>
      isSplitKey({ value: key }) &&
      typeof share === 'number' &&
      Number.isFinite(share) &&
      share > 0 &&
      share < 1
        ? [[key, share] as const]
        : [],
    ),
  );
};

const storedDetailOf = ({ detail }: DetailParams): ReadonlyArray<StoredDetail> =>
  detail.flatMap((entry): ReadonlyArray<StoredDetail> => {
    if (entry.kind === 'transcript') {
      return [{ kind: entry.kind, agentId: entry.payload.agentId }];
    }
    if (entry.kind === 'pull-request') {
      return [{ kind: entry.kind, mountId: entry.payload.mountId, tab: entry.payload.tab }];
    }
    return [];
  });

const detailEntryOf = ({ value, sessionId }: DetailValueParams): DeskDetailEntry | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (value.kind === 'transcript' && typeof value.agentId === 'string' && value.agentId !== '') {
    const agentId = brandId<AgentId>({ value: value.agentId });
    return { kind: 'transcript', sessionId, payload: { agentId } };
  }
  const tab = PR_TABS.find((known) => known === value.tab);
  if (
    value.kind === 'pull-request' &&
    typeof value.mountId === 'string' &&
    value.mountId !== '' &&
    tab !== undefined
  ) {
    const mountId = brandId<MountId>({ value: value.mountId });
    return { kind: 'pull-request', sessionId, payload: { mountId, tab } };
  }
  return null;
};

export const storedDockGridOf = ({ grid, face = 'overview', detail = [] }: GridParams): string => {
  const stored = storedDetailOf({ detail });
  return JSON.stringify({
    version: STORED_DOCK_GRID_VERSION,
    columns: grid.columns,
    used: grid.used,
    focus: grid.focus,
    widths: grid.widths,
    ...(Object.keys(grid.splits).length === 0 ? {} : { splits: grid.splits }),
    ...(face === 'desk' ? { face } : {}),
    ...(stored.length === 0 ? {} : { detail: stored }),
  });
};

export const parseStoredDeskDetail = ({
  raw,
  sessionId,
}: DeskDetailParams): ReadonlyArray<DeskDetailEntry> => {
  let value: unknown = null;
  try {
    value = JSON.parse(raw);
  } catch {
    value = null;
  }
  if (
    !isRecord(value) ||
    value.version !== STORED_DOCK_GRID_VERSION ||
    !Array.isArray(value.detail)
  ) {
    return [];
  }
  const entries = value.detail
    .slice(0, DESK_DETAIL_CAP)
    .map((item) => detailEntryOf({ value: item, sessionId }))
    .filter((entry): entry is DeskDetailEntry => entry !== null);
  return entries.filter(
    (entry, index) => entries.findIndex((other) => other.kind === entry.kind) === index,
  );
};

export const parseStoredDockGrid = ({ raw }: RawParams): DrawerGrid | null => {
  let value: unknown = null;
  try {
    value = JSON.parse(raw);
  } catch {
    value = null;
  }
  if (!isRecord(value) || value.version !== STORED_DOCK_GRID_VERSION) {
    return null;
  }
  const columns = columnsOf({ value: value.columns });
  if (columns === null) {
    return null;
  }
  const kinds = columns.flat().map((panel) => panel.kind);
  return {
    columns,
    used: usedOf({ value: value.used, kinds }),
    focus: storedFocusOf({ value: value.focus, kinds }),
    widths: widthsOf({ value: value.widths }),
    splits: splitsOf({ value: value.splits }),
  };
};
