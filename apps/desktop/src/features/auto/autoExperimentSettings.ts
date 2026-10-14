import { SETTING_AUTO_EXPERIMENT } from '../settings/settings';

type Params = {
  readonly raw: string | null | undefined;
};

export const autoExperimentSettings = ({ raw }: Params): Readonly<Record<string, string>> =>
  raw === null || raw === undefined ? {} : { [SETTING_AUTO_EXPERIMENT]: raw };
