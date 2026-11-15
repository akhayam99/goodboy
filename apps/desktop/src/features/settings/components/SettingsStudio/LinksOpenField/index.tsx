import { FieldRow, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { ownBrowserClickWord } from '../../../../browser/ownBrowserClickWord';
import { useLinksOpen } from '../../../../../shared/hooks/useLinksOpen';
import { SETTING_LINKS_OPEN, type LinksOpen } from '../../../../../shared/lib/linksOpenSetting';
import { useAppSettingSave } from '../../../hooks/useAppSettingSave';
import { SaveErrorHelp } from '../SaveErrorHelp';

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
  const help = `Click on a link, plan or report, in a session. ${ownBrowserClickWord()}: your browser.`;

  return (
    <FieldRow
      label="Links"
      help={save.error === null ? help : <SaveErrorHelp help={help} save={save} />}
    >
      <SegmentedTabs
        size="sm"
        value={save.value}
        options={LINKS_OPTIONS}
        onChange={(to) => void save.save({ value: to })}
        ariaLabel="Links"
      />
    </FieldRow>
  );
};
