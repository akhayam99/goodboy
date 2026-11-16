import { parseRunPreset, type RunPreset } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';

export type RunPresetSetting = Readonly<{
  agents: Readonly<Record<string, RunPreset>>;
}>;

type Params = { readonly raw: string | null };

export const parseRunPresets = ({ raw }: Params): RunPresetSetting => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw ?? 'null');
  } catch {
    parsed = null;
  }
  if (!isRecord(parsed) || !isRecord(parsed['agents'])) {
    return { agents: {} };
  }
  const entries: Array<readonly [string, RunPreset]> = [];
  for (const [agentId, value] of Object.entries(parsed['agents'])) {
    const preset = parseRunPreset({ value });
    if (preset !== null) {
      entries.push([agentId, preset]);
    }
  }
  return { agents: Object.fromEntries(entries) };
};
