import { brandId, type SessionId } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { DOCK_GRID_CAP } from '@goodboy/ui';
import type { TerminalTabId } from '../../../shared/types/terminal';
import type { SessionFace } from '../session-view/types';
import type {
  DrawerContent,
  DrawerFocus,
  DrawerGrid,
  DrawerGridSplits,
  DrawerGridWidths,
  OpenDrawer,
  WorkspaceToolKind,
} from './state';

const STORED_DOCK_GRID_VERSION = 1;

const TOOL_KINDS: ReadonlyArray<WorkspaceToolKind> = ['terminal', 'browser', 'monitoring'];

type GridParams = {
  readonly grid: DrawerGrid;
  readonly face?: SessionFace;
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

export const storedDockGridOf = ({ grid, face = 'overview' }: GridParams): string =>
  JSON.stringify({
    version: STORED_DOCK_GRID_VERSION,
    columns: grid.columns,
    used: grid.used,
    focus: grid.focus,
    widths: grid.widths,
    ...(Object.keys(grid.splits).length === 0 ? {} : { splits: grid.splits }),
    ...(face === 'desk' ? { face } : {}),
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
  const kinds = columns.flat().map((panel) => panel.kind);
  return {
    columns,
    used: usedOf({ value: value.used, kinds }),
    focus: storedFocusOf({ value: value.focus, kinds }),
    widths: widthsOf({ value: value.widths }),
    splits: splitsOf({ value: value.splits }),
  };
};
