import { brandId, type ProjectId, type SessionId } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { DOCK_GRID_CAP } from '@goodboy/ui';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { layoutOf } from '../dockTabs/layoutOf';
import {
  WORKSPACE_TOOL_KINDS,
  type DrawerContent,
  type DrawerFocus,
  type DrawerGrid,
  type DrawerGridSplits,
  type DrawerGridTabs,
  type DrawerGridWidths,
  type OpenDrawer,
  type WorkspaceToolKind,
} from '../state';

const STORED_DOCK_GRID_VERSION = 2;

const TOOL_KINDS = WORKSPACE_TOOL_KINDS;

type GridParams = {
  readonly grid: DrawerGrid;
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
  if (kind === 'scripts') {
    if (sessionId === null) {
      return null;
    }
    if (isRecord(payload) && typeof payload.projectId === 'string' && payload.projectId !== '') {
      const projectId = brandId<ProjectId>({ value: payload.projectId });
      return { kind, sessionId, payload: { projectId } };
    }
    return payload === null ? { kind, sessionId, payload } : null;
  }
  if (payload !== null) {
    return null;
  }
  if (kind === 'ask') {
    return sessionId === null ? null : { kind, sessionId, payload };
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
  if (!Array.isArray(value) || value.length > TOOL_KINDS.length) {
    return null;
  }
  const columns: Array<ReadonlyArray<OpenDrawer>> = [];
  for (const column of value) {
    if (!Array.isArray(column) || column.length === 0 || column.length > TOOL_KINDS.length) {
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

type TabsParams = ValueParams & {
  readonly columns: DrawerGrid['columns'];
};

const tabsOf = ({ value, columns }: TabsParams): DrawerGridTabs => {
  if (!isRecord(value)) {
    return {};
  }
  const claimed = new Set<string>();
  const entries = Object.entries(value).flatMap(([lead, tab]) => {
    const column = columns.find((candidate) => candidate.some((panel) => panel.kind === lead));
    if (column === undefined || !isRecord(tab) || !Array.isArray(tab.keys)) {
      return [];
    }
    const listed: ReadonlyArray<unknown> = tab.keys;
    const keys = listed.filter(
      (key, at): key is string =>
        typeof key === 'string' &&
        listed.indexOf(key) === at &&
        column.some((panel) => panel.kind === key),
    );
    if (
      keys.length < 2 ||
      keys.length !== listed.length ||
      !keys.includes(lead) ||
      keys.some((key) => claimed.has(key))
    ) {
      return [];
    }
    keys.forEach((key) => claimed.add(key));
    const first = keys[0] ?? lead;
    return [[lead, { keys, active: keys.find((key) => key === tab.active) ?? first }] as const];
  });
  return Object.fromEntries(entries);
};

const isWithinCap = ({ columns }: Pick<TabsParams, 'columns'>): boolean =>
  columns.length <= DOCK_GRID_CAP.columns &&
  columns.every((column) => column.length <= DOCK_GRID_CAP.rows);

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

export const storedDockGridOf = ({ grid }: GridParams): string =>
  JSON.stringify({
    version: STORED_DOCK_GRID_VERSION,
    columns: grid.columns,
    used: grid.used,
    focus: grid.focus,
    widths: grid.widths,
    ...(grid.tabs === undefined || Object.keys(grid.tabs).length === 0 ? {} : { tabs: grid.tabs }),
    ...(Object.keys(grid.splits).length === 0 ? {} : { splits: grid.splits }),
  });

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
  const tabs = tabsOf({ value: value.tabs, columns });
  if (!isWithinCap({ columns: layoutOf({ columns, tabs }).columns })) {
    return null;
  }
  const kinds = columns.flat().map((panel) => panel.kind);
  return {
    columns,
    ...(Object.keys(tabs).length === 0 ? {} : { tabs }),
    used: usedOf({ value: value.used, kinds }),
    focus: storedFocusOf({ value: value.focus, kinds }),
    widths: widthsOf({ value: value.widths }),
    splits: splitsOf({ value: value.splits }),
  };
};
