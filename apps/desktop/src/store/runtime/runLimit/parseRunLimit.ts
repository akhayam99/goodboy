import { isRecord } from '@goodboy/types/helpers';

export type RunLimitSetting = Readonly<{
  agents: Readonly<Record<string, number | null>>;
}>;

type Params = { readonly raw: string | null };

export const parseRunLimit = ({ raw }: Params): RunLimitSetting => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw ?? 'null');
  } catch {
    parsed = null;
  }
  if (!isRecord(parsed) || !isRecord(parsed['agents'])) {
    return { agents: {} };
  }
  const entries: Array<readonly [string, number | null]> = [];
  for (const [agentId, value] of Object.entries(parsed['agents'])) {
    if (value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0)) {
      entries.push([agentId, value]);
    }
  }
  return { agents: Object.fromEntries(entries) };
};
