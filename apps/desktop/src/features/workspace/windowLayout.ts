import type { WorkspaceId } from '@goodboy/types';
import { deleteSetting, listSettingsWithPrefix, setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';
import { EMPTY_FOCUS, type Focus, type Location } from '../../store/slices/navigation/types';

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

const isPlace = (value: unknown): value is Location['place'] => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.at === 'board') {
    return true;
  }
  if (value.at !== 'session' || typeof value.sessionId !== 'string') {
    return false;
  }
  const view = value.view;
  return (
    isRecord(view) &&
    isNullableString(view.lens) &&
    isNullableString(view.agentId) &&
    (view.studio === null || isRecord(view.studio)) &&
    (view.target === null || isRecord(view.target))
  );
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
    drawer: isRecord(value.drawer) ? (value.drawer as unknown as Focus['drawer']) : null,
    selection,
    scroll,
    revealed,
  };
};

export const parseLocation = ({ value }: { readonly value: unknown }): Location | null => {
  if (!isRecord(value) || !isPlace(value.place)) {
    return null;
  }
  return {
    workspaceId: typeof value.workspaceId === 'string' ? (value.workspaceId as WorkspaceId) : null,
    place: value.place,
    studio: isRecord(value.studio) ? (value.studio as unknown as Location['studio']) : null,
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
    if (!isRecord(value) || typeof value.workspaceId !== 'string' || typeof value.at !== 'number') {
      return null;
    }
    const location = parseLocation({ value: value.location });
    if (location === null) {
      return null;
    }
    return { label, workspaceId: value.workspaceId as WorkspaceId, location, at: value.at };
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
