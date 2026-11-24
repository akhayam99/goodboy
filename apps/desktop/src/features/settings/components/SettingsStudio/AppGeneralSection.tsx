import { Band } from '@goodboy/ui';
import { ContrastPreferenceField } from './ContrastPreferenceField';
import { ThemePreferenceField } from './ThemePreferenceField';
import { AwayAlertsBand } from './AwayAlertsBand';
import { UpdatesSection } from './UpdatesSection';

type Props = {
  readonly isUpdatesFocused?: boolean;
};

export const AppGeneralSection = ({ isUpdatesFocused = false }: Props) => (
  <div className="flex flex-col gap-6">
    <Band inset="content" label="Appearance" headingLevel={2}>
      <div className="flex flex-col">
        <ThemePreferenceField />
        <ContrastPreferenceField />
      </div>
    </Band>

    <AwayAlertsBand />

    <UpdatesSection isFocused={isUpdatesFocused} />
  </div>
);
