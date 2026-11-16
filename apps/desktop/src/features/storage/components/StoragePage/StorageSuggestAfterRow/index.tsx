import { Listbox } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import {
  STORAGE_SUGGEST_AFTER_KEY,
  SUGGEST_AFTER_OPTIONS,
  suggestAfterDaysOf,
} from '../../../../../store/slices/storage/storageSettings';
import { useAppSettingSave } from '../../../../settings/appSettingSave';
import { SettingRow } from '../../../../settings/settingRow';

const DEFAULT_DAYS = String(suggestAfterDaysOf({ settings: {} }));

type ValueParams = {
  readonly value: string;
};

const daysLabelOf = ({ value }: ValueParams): string => `${value} days`;

export const StorageSuggestAfterRow = () => {
  const rawDays = useAppStore((state) => state.settings[STORAGE_SUGGEST_AFTER_KEY]);
  const save = useAppSettingSave({
    settingKey: STORAGE_SUGGEST_AFTER_KEY,
    saved: String(
      suggestAfterDaysOf({
        settings: rawDays === undefined ? {} : { [STORAGE_SUGGEST_AFTER_KEY]: rawDays },
      }),
    ),
    encode: ({ value }) => value,
    display: daysLabelOf,
    failureTitle: "Couldn't save the cleanup setting",
  });

  return (
    <SettingRow
      label="Suggest cleanup after"
      rowKey="suggest-cleanup"
      help="Folders idle this long show up as safe to remove."
      isChanged={save.value !== DEFAULT_DAYS}
      onReset={() => void save.save({ value: DEFAULT_DAYS })}
      save={save}
    >
      <Listbox
        ariaLabel="Suggest cleanup after"
        size="sm"
        value={save.value}
        options={SUGGEST_AFTER_OPTIONS.map((option) => ({
          value: String(option),
          label: daysLabelOf({ value: String(option) }),
        }))}
        onChange={(next) => void save.save({ value: next })}
      />
    </SettingRow>
  );
};
