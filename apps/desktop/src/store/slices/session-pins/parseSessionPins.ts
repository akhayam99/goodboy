import type { SessionId } from '@goodboy/types';
import type { SessionPin } from './state';

type ParseParams = {
  readonly raw: string | null;
};

type SerializeParams = {
  readonly pins: ReadonlyArray<SessionPin>;
};

type PruneParams = {
  readonly pins: ReadonlyArray<SessionPin>;
  readonly liveIds: ReadonlySet<string>;
};

const isPinRecord = (entry: unknown): entry is { readonly id: string; readonly at: number } => {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }
  const id = Reflect.get(entry, 'id');
  const at = Reflect.get(entry, 'at');
  return typeof id === 'string' && id !== '' && typeof at === 'number' && Number.isFinite(at);
};

export const parseSessionPins = ({ raw }: ParseParams): ReadonlyArray<SessionPin> => {
  if (raw === null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const records = parsed.filter(isPinRecord).sort((first, second) => first.at - second.at);
  const seen = new Set<string>();
  const pins: SessionPin[] = [];
  for (const record of records) {
    if (seen.has(record.id)) {
      continue;
    }
    seen.add(record.id);
    pins.push({ id: record.id as SessionId, at: record.at });
  }
  return pins;
};

export const serializeSessionPins = ({ pins }: SerializeParams): string =>
  JSON.stringify(pins.map(({ id, at }) => ({ id, at })));

export const pruneSessionPins = ({ pins, liveIds }: PruneParams): ReadonlyArray<SessionPin> => {
  const kept = pins.filter((pin) => liveIds.has(pin.id));
  return kept.length === pins.length ? pins : kept;
};
