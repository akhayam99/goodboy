import { NOTHING_CHANGED } from '../../../../../store/slices/notifications/errorRecovery';
import { FieldRow, Listbox } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import {
  STORAGE_SUGGEST_AFTER_KEY,
  SUGGEST_AFTER_OPTIONS,
  suggestAfterDaysOf,
} from '../../../../../store/slices/storage/storageSettings';

export const StorageSuggestAfterRow = () => {
  const rawDays = useAppStore((state) => state.settings[STORAGE_SUGGEST_AFTER_KEY]);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);
  const days = suggestAfterDaysOf({
    settings: rawDays === undefined ? {} : { [STORAGE_SUGGEST_AFTER_KEY]: rawDays },
  });

  return (
    <FieldRow
      label="Suggest cleanup after"
      help="Folders idle this long show up as safe to remove."
      className="px-2"
    >
      <Listbox
        ariaLabel="Suggest cleanup after"
        size="sm"
        value={String(days)}
        options={SUGGEST_AFTER_OPTIONS.map((option) => ({
          value: String(option),
          label: `${option} days`,
        }))}
        onChange={(next) =>
          void saveSetting(STORAGE_SUGGEST_AFTER_KEY, next).catch((error: unknown) =>
            reportError({
              recovery: NOTHING_CHANGED,
              title: "Couldn't save the cleanup setting",
              error,
            }),
          )
        }
      />
    </FieldRow>
  );
};
