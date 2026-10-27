import type { SettingLevel } from './levelOfSetting';

type Params = {
  readonly level: SettingLevel;
};

export const levelChipLabel = ({ level }: Params): string | null => {
  if (level === 'project') {
    return 'From project';
  }
  if (level === 'session') {
    return 'From session';
  }
  return null;
};
