import { isRecord } from '@goodboy/types/helpers';

export type RunGuidanceSetting = Readonly<{
  agents: Readonly<Record<string, string>>;
}>;

type Params = { readonly raw: string | null };

export const parseRunGuidance = ({ raw }: Params): RunGuidanceSetting => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw ?? 'null');
  } catch {
    parsed = null;
  }
  if (!isRecord(parsed) || !isRecord(parsed['agents'])) {
    return { agents: {} };
  }
  const entries: Array<readonly [string, string]> = [];
  for (const [agentId, value] of Object.entries(parsed['agents'])) {
    if (typeof value === 'string' && value.trim() !== '') {
      entries.push([agentId, value]);
    }
  }
  return { agents: Object.fromEntries(entries) };
};
