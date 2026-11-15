import { flowRulesOf } from '../../../features/work/flowRulesOf';
import { SETTING_WORK_ENABLED } from '../../../shared/lib/workSetting';
import { CHECK_STATE } from '../notifications/errorRecovery';
import { BOARD_PLACE } from './place';
import type { GetFn, Location } from './types';

type Params = {
  readonly get: GetFn;
  readonly location: Location;
};

const readIsWork = async ({ get }: Pick<Params, 'get'>): Promise<boolean> => {
  const known = get().settings[SETTING_WORK_ENABLED];
  if (known !== undefined) {
    return known === 'true';
  }
  try {
    return (await get().loadSetting(SETTING_WORK_ENABLED)) === 'true';
  } catch (error) {
    void get().reportError({
      title: "Couldn't read the Work setting",
      error,
      recovery: CHECK_STATE,
      severity: 'warning',
    });
    return false;
  }
};

export const foldedWorkPlace = async ({ get, location }: Params): Promise<Location> => {
  if (location.studio?.kind !== 'work') {
    return location;
  }
  const isWork = await readIsWork({ get });
  if (flowRulesOf({ isWork }).savedPlaceOnWork === 'work') {
    return location;
  }
  return {
    ...location,
    place: BOARD_PLACE,
    studio: null,
    focus: { ...location.focus, drawer: null },
  };
};
