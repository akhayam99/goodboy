import { useEffect } from 'react';
import { Band, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { SETTING_REPO_CHECK_MINUTES } from '../../settings';
import {
  DEFAULT_REPO_CHECK_MINUTES,
  repoCheckMinutesOf,
} from '../../../workspace/repoCheckMinutesOf';
import { READ_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { useAppSettingSave } from '../../hooks/useAppSettingSave';
import { SettingRow } from './SettingRow';

const HELP = 'How often each base branch is compared with origin.';

const INTERVAL_OPTIONS: ReadonlyArray<SegmentedTabOption<string>> = [
  { value: '0', label: 'Off' },
  { value: '5', label: '5 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
];

type ValueParams = {
  readonly value: string;
};

const intervalLabelOf = ({ value }: ValueParams): string =>
  INTERVAL_OPTIONS.find((option) => option.value === value)?.label ?? `${value} min`;

export const RepoCheckBand = () => {
  const raw = useAppStore((state) => state.settings[SETTING_REPO_CHECK_MINUTES]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);
  const save = useAppSettingSave({
    settingKey: SETTING_REPO_CHECK_MINUTES,
    saved: String(repoCheckMinutesOf({ value: raw })),
    encode: ({ value }) => value,
    display: intervalLabelOf,
    failureTitle: "Couldn't save how often to check the repositories",
  });

  useEffect(() => {
    if (raw !== undefined) {
      return;
    }
    void loadSetting(SETTING_REPO_CHECK_MINUTES).catch((error: unknown) =>
      reportError({
        recovery: READ_FAILED,
        title: "Couldn't read how often to check the repositories",
        error,
      }),
    );
  }, [raw, loadSetting, reportError]);

  return (
    <Band
      inset="content"
      label="Git"
      hint="Fetches origin in the background. Goodboy never pulls by itself."
      headingLevel={2}
    >
      <div className="flex flex-col">
        <SettingRow
          label="Check origin"
          rowKey="check-origin"
          help={HELP}
          isChanged={save.value !== String(DEFAULT_REPO_CHECK_MINUTES)}
          onReset={() => void save.save({ value: String(DEFAULT_REPO_CHECK_MINUTES) })}
          save={save}
        >
          <SegmentedTabs
            size="sm"
            ariaLabel="Check origin every"
            value={save.value}
            options={INTERVAL_OPTIONS}
            onChange={(next) => void save.save({ value: next })}
          />
        </SettingRow>
      </div>
    </Band>
  );
};
