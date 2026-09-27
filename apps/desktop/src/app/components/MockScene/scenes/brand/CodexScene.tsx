import { SettingsFrame } from '../audit/SettingsFrame';
import { sceneParam } from '../audit/sceneParams';
import { useFakeTauri, type FakeHandlers } from './fakeTauri';
import { seedBrandLimits } from './limitsSeed';
import { seedBrandSettings } from './settingsBrandSeed';

const weekParam = Number(sceneParam({ key: 'week' }) ?? '');

const WEEK = Number.isFinite(weekParam) && weekParam > 0 && weekParam <= 1 ? weekParam : undefined;

const CODEX_SPEND = { today: 1.94, week: 18.4, month: 61.2 };

const HANDLERS: FakeHandlers = {
  db_select: (args) => {
    const sql = typeof args?.['sql'] === 'string' ? args['sql'] : '';
    return sql.includes('AS today') ? [CODEX_SPEND] : [];
  },
};

const seedCodex = (): void => {
  seedBrandSettings();
  seedBrandLimits({ codexWeekly: WEEK });
};

export const BrandCodexScene = () => {
  useFakeTauri({ handlers: HANDLERS, holdMs: 6000 });
  return <SettingsFrame focus={{ scope: 'providers', provider: 'codex' }} seed={seedCodex} />;
};
