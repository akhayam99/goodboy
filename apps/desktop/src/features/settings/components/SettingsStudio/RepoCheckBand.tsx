import { useEffect, useState } from 'react';
import { Band, FieldRow, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { SETTING_REPO_CHECK_MINUTES } from '../../settings';
import { repoCheckMinutesOf } from '../../../workspace/repoCheckMinutesOf';

const INTERVAL_OPTIONS: ReadonlyArray<SegmentedTabOption<string>> = [
  { value: '0', label: 'Off' },
  { value: '5', label: '5 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
];

type ChooseParams = {
  readonly next: string;
};

export const RepoCheckBand = () => {
  const raw = useAppStore((state) => state.settings[SETTING_REPO_CHECK_MINUTES]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);
  const [isSaving, setIsSaving] = useState(false);
  const minutes = repoCheckMinutesOf({ value: raw });

  useEffect(() => {
    if (raw !== undefined) {
      return;
    }
    void loadSetting(SETTING_REPO_CHECK_MINUTES).catch((error: unknown) =>
      reportError({ title: "Couldn't read how often to check the repositories", error }),
    );
  }, [raw, loadSetting, reportError]);

  const choose = async ({ next }: ChooseParams): Promise<void> => {
    setIsSaving(true);
    try {
      await saveSetting(SETTING_REPO_CHECK_MINUTES, next);
    } catch (error) {
      void reportError({ title: "Couldn't save how often to check the repositories", error });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Band
      inset="content"
      label="Git"
      hint="Fetches origin in the background. Goodboy never pulls by itself."
      headingLevel={2}
    >
      <div className="flex flex-col">
        <FieldRow label="Check origin" help="How often each base branch is compared with origin.">
          <SegmentedTabs
            size="sm"
            ariaLabel="Check origin every"
            value={String(minutes)}
            options={INTERVAL_OPTIONS.map((option) => ({ ...option, disabled: isSaving }))}
            onChange={(next) => void choose({ next })}
          />
        </FieldRow>
      </div>
    </Band>
  );
};
