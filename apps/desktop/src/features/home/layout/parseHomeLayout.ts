import { parseJsonOrNull } from '../../../shared/utils/parseJsonOrNull';
import { homeWidgetIdOf } from './homeWidgetIdOf';
import { HOME_LAYOUT_VERSION, type HomeLayout, type HomeLayoutEntry } from './layoutTypes';
import { widgetSizeOf } from './widgetSizeOf';

type Params = {
  readonly raw: string | null;
};

type RecordParams = {
  readonly value: unknown;
};

const recordOf = ({ value }: RecordParams): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : null;

export const parseHomeLayout = ({ raw }: Params): HomeLayout | null => {
  if (raw === null) {
    return null;
  }
  const parsed = recordOf({ value: parseJsonOrNull({ raw }) });
  if (parsed === null || parsed.v !== HOME_LAYOUT_VERSION || !Array.isArray(parsed.widgets)) {
    return null;
  }
  const widgets: ReadonlyArray<unknown> = parsed.widgets;
  const entries: HomeLayoutEntry[] = [];
  for (const candidate of widgets) {
    const entry = recordOf({ value: candidate });
    if (entry === null) {
      continue;
    }
    const id = homeWidgetIdOf({ value: entry.id });
    if (id === null || entries.some((known) => known.id === id)) {
      continue;
    }
    entries.push({ id, size: widgetSizeOf({ id, value: entry.size }) });
  }
  return entries;
};
