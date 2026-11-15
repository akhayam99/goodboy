import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { ownBrowserClickWord } from '../../../../browser/ownBrowserClickWord';
import { useLinksOpen } from '../../../../../shared/hooks/useLinksOpen';
import {
  DEFAULT_LINKS_OPEN,
  SETTING_LINKS_OPEN,
  type LinksOpen,
} from '../../../../../shared/lib/linksOpenSetting';
import { useAppSettingSave } from '../../../hooks/useAppSettingSave';
import { SettingRow } from '../SettingRow';

const LINKS_OPTIONS: ReadonlyArray<SegmentedTabOption<LinksOpen>> = [
  { value: 'goodboy', label: 'In Goodboy' },
  { value: 'browser', label: 'In your browser' },
];

type ValueParams = {
  readonly value: LinksOpen;
};

const linksLabelOf = ({ value }: ValueParams): string =>
  LINKS_OPTIONS.find((option) => option.value === value)?.label ?? value;

export const LinksOpenField = () => {
  const save = useAppSettingSave({
    settingKey: SETTING_LINKS_OPEN,
    saved: useLinksOpen(),
    encode: ({ value }) => value,
    display: linksLabelOf,
    failureTitle: "Couldn't save where links open",
  });

  return (
    <SettingRow
      label="Links"
      rowKey="links-open"
      help={`Click on a link, plan or report, in a session. ${ownBrowserClickWord()}: your browser.`}
      isChanged={save.value !== DEFAULT_LINKS_OPEN}
      onReset={() => void save.save({ value: DEFAULT_LINKS_OPEN })}
      save={save}
    >
      <SegmentedTabs
        size="sm"
        value={save.value}
        options={LINKS_OPTIONS}
        onChange={(to) => void save.save({ value: to })}
        ariaLabel="Links"
      />
    </SettingRow>
  );
};
