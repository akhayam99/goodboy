import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { ownBrowserClickWord } from '../../../../browser/ownBrowserClickWord';
import { useLinksOpen } from '../../../../../shared/hooks/useLinksOpen';
import { useAppStore } from '../../../../../store';
import { CHECK_STATE } from '../../../../../store/slices/notifications/errorRecovery';
import {
  DEFAULT_LINKS_OPEN,
  SETTING_LINKS_OPEN,
  type LinksOpen,
} from '../../../../../shared/lib/linksOpenSetting';
import { SettingRow } from '../SettingRow';

const LINKS_OPTIONS: ReadonlyArray<SegmentedTabOption<LinksOpen>> = [
  { value: 'goodboy', label: 'In Goodboy' },
  { value: 'browser', label: 'In your browser' },
];

type ChangeParams = {
  readonly to: LinksOpen;
};

export const LinksOpenField = () => {
  const value = useLinksOpen();
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);

  const onChange = async ({ to }: ChangeParams) => {
    try {
      await saveSetting(SETTING_LINKS_OPEN, to);
    } catch (error) {
      void reportError({
        title: "Couldn't save where links open",
        error,
        recovery: CHECK_STATE,
      });
    }
  };

  return (
    <SettingRow
      label="Links"
      help={`Click on a link, plan or report, in a session. ${ownBrowserClickWord()}: your browser.`}
      isChanged={value !== DEFAULT_LINKS_OPEN}
      onReset={() => void onChange({ to: DEFAULT_LINKS_OPEN })}
    >
      <SegmentedTabs
        size="sm"
        value={value}
        options={LINKS_OPTIONS}
        onChange={(to) => void onChange({ to })}
        ariaLabel="Links"
      />
    </SettingRow>
  );
};
