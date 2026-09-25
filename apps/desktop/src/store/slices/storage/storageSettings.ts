export const STORAGE_SUGGEST_AFTER_KEY = 'storage.suggestAfterDays';
export const STORAGE_KEPT_ARCHIVED_KEY = 'storage.keptArchived';
export const STORAGE_LAST_NUDGE_AT_KEY = 'storage.lastNudgeAt';
export const STORAGE_LAST_NUDGE_BYTES_KEY = 'storage.lastNudgeBytes';

export const DEFAULT_SUGGEST_AFTER_DAYS = 30;

export const SUGGEST_AFTER_OPTIONS = [7, 14, 30, 60, 90] as const satisfies ReadonlyArray<number>;

type SettingsParams = {
  readonly settings: Readonly<Record<string, string>>;
};

export type KeptArchivedEntry = {
  readonly keptAt: number;
  readonly keptUntil: number | null;
};

export type KeptArchived = Readonly<Record<string, KeptArchivedEntry>>;

export const suggestAfterDaysOf = ({ settings }: SettingsParams): number => {
  const raw = settings[STORAGE_SUGGEST_AFTER_KEY];
  if (raw === undefined) {
    return DEFAULT_SUGGEST_AFTER_DAYS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SUGGEST_AFTER_DAYS;
};

type StoredNumberParams = SettingsParams & {
  readonly key: string;
};

export const storedNumberOf = ({ settings, key }: StoredNumberParams): number | null => {
  const raw = settings[key];
  if (raw === undefined) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const isKeptEntry = (value: unknown): value is KeptArchivedEntry => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const keptAt: unknown = Reflect.get(value, 'keptAt');
  const keptUntil: unknown = Reflect.get(value, 'keptUntil');
  return typeof keptAt === 'number' && (keptUntil === null || typeof keptUntil === 'number');
};

export const keptArchivedOf = ({ settings }: SettingsParams): KeptArchived => {
  const raw = settings[STORAGE_KEPT_ARCHIVED_KEY];
  if (raw === undefined) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, KeptArchivedEntry] =>
        isKeptEntry(entry[1]),
      ),
    );
  } catch {
    return {};
  }
};
