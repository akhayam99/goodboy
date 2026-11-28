import { PREFERRED_LANGUAGES } from '@goodboy/core/language';
import type { WorkspaceId } from '@goodboy/types';
import { Listbox } from '@goodboy/ui';
import { AUTO_LANGUAGE, usePreferredLanguage } from '../../../hooks/usePreferredLanguage';
import { SettingRow } from '../SettingRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const LABEL = 'Preferred language';

const OPTIONS = [
  { value: AUTO_LANGUAGE, label: 'Auto' },
  ...PREFERRED_LANGUAGES.map((language) => ({ value: language.code, label: language.nativeName })),
];

export const PreferredLanguageField = ({ workspaceId }: Props) => {
  const language = usePreferredLanguage({ workspaceId });
  return (
    <SettingRow
      label={LABEL}
      rowKey="preferred-language"
      help="The language agents answer in. Auto follows the language you write in."
      isChanged={language.value !== AUTO_LANGUAGE}
      onReset={() => void language.save({ value: AUTO_LANGUAGE })}
      save={language}
    >
      <Listbox
        size="sm"
        value={language.value}
        options={OPTIONS}
        onChange={(value) => void language.save({ value })}
        ariaLabel={LABEL}
      />
    </SettingRow>
  );
};
