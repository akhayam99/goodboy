import { Listbox } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import {
  STORAGE_SUGGEST_AFTER_KEY,
  SUGGEST_AFTER_OPTIONS,
  suggestAfterDaysOf,
} from '../../../../store/slices/storage/storageSettings';

export const StorageSuggestAfterPicker = () => {
  const rawDays = useAppStore((state) => state.settings[STORAGE_SUGGEST_AFTER_KEY]);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);
  const days = suggestAfterDaysOf({
    settings: rawDays === undefined ? {} : { [STORAGE_SUGGEST_AFTER_KEY]: rawDays },
  });

  const onDays = (next: string) =>
    void saveSetting(STORAGE_SUGGEST_AFTER_KEY, next).catch((error: unknown) =>
      reportError({ title: "Couldn't save the cleanup setting", error }),
    );

  return (
    <Listbox
      ariaLabel="Suggest cleanup after"
      trigger="quiet"
      size="sm"
      value={String(days)}
      valueLabel={
        <span>
          <span className="text-muted-foreground">Suggest cleanup after</span> {days} days
        </span>
      }
      options={SUGGEST_AFTER_OPTIONS.map((option) => ({
        value: String(option),
        label: `${option} days`,
      }))}
      onChange={onDays}
    />
  );
};
