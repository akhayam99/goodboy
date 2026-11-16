import type { SettingsGroup } from './components/SettingsStudio/settingsDirectory';
import { availableSettingRows } from './availableSettingRows';
import type { SettingRow } from './settingRows';
import { settingRowPlace } from './settingRowPlace';
import { SETTING_ROW_KEY_PREFIX, settingsPaletteEntries } from './settingsPaletteEntries';
import type { SettingsFocus } from './settingsFocus';

export type SettingsSearchHit = {
  readonly key: string;
  readonly label: string;
  readonly place: string | null;
  readonly run: () => void;
};

type Params = {
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly query: string;
  readonly open: (focus: SettingsFocus) => void;
};

type TextParams = {
  readonly text: string;
  readonly needle: string;
};

const has = ({ text, needle }: TextParams): boolean => text.toLowerCase().includes(needle);

const startsWord = ({ text, needle }: TextParams): boolean => {
  const lower = text.toLowerCase();
  return lower.startsWith(needle) || lower.includes(` ${needle}`);
};

type TierParams = {
  readonly row: SettingRow;
  readonly needle: string;
};

const NO_MATCH = -1;

const tierOf = ({ row, needle }: TierParams): number => {
  if (startsWord({ text: row.label, needle })) {
    return 0;
  }
  if (has({ text: row.label, needle })) {
    return 1;
  }
  if (row.formerNames.some((name) => has({ text: name, needle }))) {
    return 2;
  }
  if (has({ text: row.help, needle }) || (row.band !== null && has({ text: row.band, needle }))) {
    return 3;
  }
  return NO_MATCH;
};

export const settingsSearchHits = ({
  groups,
  query,
  open,
}: Params): ReadonlyArray<SettingsSearchHit> => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [];
  }
  const pages = settingsPaletteEntries({ groups, open })
    .filter(
      (entry) =>
        !entry.key.startsWith(SETTING_ROW_KEY_PREFIX) &&
        [entry.label, ...(entry.secondary ?? [])].some((text) => has({ text, needle })),
    )
    .map((entry): SettingsSearchHit => ({
      key: entry.key,
      label: entry.label,
      place: null,
      run: entry.run,
    }));
  const rows = availableSettingRows({ groups })
    .map((row) => ({ row, tier: tierOf({ row, needle }) }))
    .filter(({ tier }) => tier !== NO_MATCH)
    .sort((left, right) => left.tier - right.tier)
    .map(({ row }): SettingsSearchHit => ({
      key: `${SETTING_ROW_KEY_PREFIX}${row.key}`,
      label: row.label,
      place: settingRowPlace({ row }),
      run: () => open({ ...row.page, row: row.key }),
    }));
  return [...pages, ...rows];
};
