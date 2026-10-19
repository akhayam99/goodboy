import { useAppStore } from '../../../store';
import { tauriDatabase } from '../../../shared/lib/db';
import { SETTING_OVERVIEW_LAYOUT } from '../../settings/settings';
import type { OverviewLayout } from './overviewLayoutOf';
import { writeOverviewLayout } from './writeOverviewLayout';

type Params = {
  readonly layout: OverviewLayout;
};

export const applyOverviewLayout = async ({ layout }: Params): Promise<void> => {
  try {
    await writeOverviewLayout({ db: tauriDatabase, layout });
  } finally {
    await useAppStore.getState().loadSetting(SETTING_OVERVIEW_LAYOUT);
  }
};
