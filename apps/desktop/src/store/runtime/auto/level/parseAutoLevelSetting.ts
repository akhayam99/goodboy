import type { AutoLevel } from '@goodboy/core';
import { isRecord } from '@goodboy/types/helpers';

export type AutoLevelSettings = Readonly<{
  defaultLevel: AutoLevel | null;
  sessions: Readonly<Record<string, AutoLevel>>;
}>;

type Params = { readonly raw: string | null };
type LevelParams = { readonly value: unknown };

const parseStoredLevel = ({ value }: LevelParams): AutoLevel | null => {
  if (value === 'step' || value === 'plan' || value === 'run') {
    return value;
  }
  return null;
};

export const parseAutoLevelSetting = ({ raw }: Params): AutoLevelSettings => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw ?? 'null');
  } catch {
    parsed = null;
  }
  if (!isRecord(parsed)) {
    return { defaultLevel: null, sessions: {} };
  }
  const entries = isRecord(parsed['sessions']) ? Object.entries(parsed['sessions']) : [];
  const sessions: Array<readonly [string, AutoLevel]> = [];
  for (const [sessionId, value] of entries) {
    const level = parseStoredLevel({ value });
    if (level !== null) {
      sessions.push([sessionId, level]);
    }
  }
  return {
    defaultLevel: parseStoredLevel({ value: parsed['defaultLevel'] }),
    sessions: Object.fromEntries(sessions),
  };
};
