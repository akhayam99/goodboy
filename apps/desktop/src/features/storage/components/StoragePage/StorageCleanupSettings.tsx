import { useState, type ChangeEvent } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Plus } from 'lucide-react';
import { Button, Eyebrow, Select } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import {
  STORAGE_SUGGEST_AFTER_KEY,
  SUGGEST_AFTER_OPTIONS,
  suggestAfterDaysOf,
} from '../../../../store/slices/storage/storageSettings';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export const StorageCleanupSettings = () => {
  const rawDays = useAppStore((state) => state.settings[STORAGE_SUGGEST_AFTER_KEY]);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const scanStorageRepository = useAppStore((state) => state.scanStorageRepository);
  const reportError = useAppStore((state) => state.reportError);
  const [isScanning, setIsScanning] = useState(false);
  const days = suggestAfterDaysOf({
    settings: rawDays === undefined ? {} : { [STORAGE_SUGGEST_AFTER_KEY]: rawDays },
  });

  const onDays = ({ target }: ChangeEvent<HTMLSelectElement>) =>
    void saveSetting(STORAGE_SUGGEST_AFTER_KEY, target.value).catch((error: unknown) =>
      reportError({ title: "Couldn't save the cleanup setting", error }),
    );

  const onScan = async () => {
    const picked = await openDialog({ directory: true, multiple: false }).catch(() => null);
    if (typeof picked !== 'string') {
      return;
    }
    setIsScanning(true);
    try {
      await scanStorageRepository({ repoRoot: picked });
    } catch (error) {
      void reportError({ title: "Couldn't scan that repository", error });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <section aria-label="Cleanup" className="flex flex-col gap-1">
      <Eyebrow label="Cleanup" />
      <div className="flex min-h-10 items-center gap-3 px-2 text-sm">
        <label htmlFor="storage-suggest-after" className="flex min-w-0 flex-1 flex-col">
          <span className="text-foreground">Suggest cleanup after</span>
          <span className="text-2xs text-faint-foreground">
            Clean folders idle longer than this are preselected and counted in &quot;can go&quot;.
          </span>
        </label>
        <Select id="storage-suggest-after" size="sm" value={String(days)} onChange={onDays}>
          {SUGGEST_AFTER_OPTIONS.map((option) => (
            <option key={option} value={String(option)}>
              {option} days
            </option>
          ))}
        </Select>
      </div>
      <div className="flex min-h-10 items-center gap-3 px-2 text-sm">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-foreground">Scan another repository</span>
          <span className="text-2xs text-faint-foreground">
            For a repository Goodboy used in a workspace you removed.
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void onScan()}
          isBusy={isScanning}
          busyLabel="Scanning"
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
          Choose folder
        </Button>
      </div>
    </section>
  );
};
