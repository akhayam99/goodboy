import type { SessionId, WorkspaceId } from '@goodboy/types';
import { deleteSetting, listSettingsWithPrefix, setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';
import {
  EMPTY_FOCUS,
  type Focus,
  type Location,
  type SessionView,
} from '../../store/slices/navigation/types';

const WINDOW_LAYOUT_PREFIX = 'window.layout.';

const MAX_LAYOUT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type WindowLayout = {
  readonly label: string;
  readonly workspaceId: WorkspaceId;
  readonly location: Location;
  readonly at: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const isWorkspaceId = (value: unknown): value is WorkspaceId => typeof value === 'string';

const isSessionId = (value: unknown): value is SessionId => typeof value === 'string';

const isViewLens = (value: unknown): value is SessionView['lens'] => isNullableString(value);

const isViewAgentId = (value: unknown): value is SessionView['agentId'] => isNullableString(value);

const isViewTarget = (value: unknown): value is SessionView['target'] =>
  value === null || isRecord(value);

const isDrawer = (value: unknown): value is Focus['drawer'] => isRecord(value);

const isStudio = (value: unknown): value is Location['studio'] => isRecord(value);

type PlaceParams = {
  readonly value: unknown;
};

const placeOf = ({ value }: PlaceParams): Location['place'] | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (value.at === 'board') {
    return { at: 'board' };
  }
  const sessionId = value.sessionId;
  if (value.at !== 'session' || !isSessionId(sessionId)) {
    return null;
  }
  const view = value.view;
  if (!isRecord(view)) {
    return null;
  }
  const lens = view.lens;
  const agentId = view.agentId;
  const target = view.target;
  if (!isViewLens(lens) || !isViewAgentId(agentId) || !isViewTarget(target)) {
    return null;
  }
  return { at: 'session', sessionId, view: { lens, agentId, target } };
};

const focusOf = ({ value }: { readonly value: unknown }): Focus => {
  if (!isRecord(value)) {
    return EMPTY_FOCUS;
  }
  const scroll = isRecord(value.scroll)
    ? Object.fromEntries(
        Object.entries(value.scroll).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === 'number' && Number.isFinite(entry[1]),
        ),
      )
    : {};
  const selection = isRecord(value.selection)
    ? Object.fromEntries(
        Object.entries(value.selection).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};
  const revealed = Array.isArray(value.revealed)
    ? value.revealed.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    drawer: isDrawer(value.drawer) ? value.drawer : null,
    selection,
    scroll,
    revealed,
  };
};

export const parseLocation = ({ value }: { readonly value: unknown }): Location | null => {
  if (!isRecord(value)) {
    return null;
  }
  const place = placeOf({ value: value.place });
  if (place === null) {
    return null;
  }
  return {
    workspaceId: isWorkspaceId(value.workspaceId) ? value.workspaceId : null,
    place,
    studio: isStudio(value.studio) ? value.studio : null,
    focus: focusOf({ value: value.focus }),
  };
};

const parseLayout = ({
  label,
  raw,
}: {
  readonly label: string;
  readonly raw: string;
}): WindowLayout | null => {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !isWorkspaceId(value.workspaceId) || typeof value.at !== 'number') {
      return null;
    }
    const location = parseLocation({ value: value.location });
    if (location === null) {
      return null;
    }
    return { label, workspaceId: value.workspaceId, location, at: value.at };
  } catch {
    return null;
  }
};

const serializeWindowLayout = ({
  workspaceId,
  location,
  at,
}: Omit<WindowLayout, 'label'>): string => JSON.stringify({ workspaceId, location, at });

export const saveWindowLayout = async (layout: WindowLayout): Promise<void> => {
  await setSetting(
    tauriDatabase,
    `${WINDOW_LAYOUT_PREFIX}${layout.label}`,
    serializeWindowLayout(layout),
  );
};

export const forgetWindowLayout = async ({ label }: { readonly label: string }): Promise<void> => {
  await deleteSetting(tauriDatabase, `${WINDOW_LAYOUT_PREFIX}${label}`);
};

export const listWindowLayouts = async ({
  nowMs,
}: {
  readonly nowMs: number;
}): Promise<ReadonlyArray<WindowLayout>> => {
  const rows = await listSettingsWithPrefix(tauriDatabase, WINDOW_LAYOUT_PREFIX);
  return rows.flatMap((row) => {
    const layout = parseLayout({
      label: row.key.slice(WINDOW_LAYOUT_PREFIX.length),
      raw: row.value,
    });
    if (layout === null || nowMs - layout.at > MAX_LAYOUT_AGE_MS) {
      return [];
    }
    return [layout];
  });
};
