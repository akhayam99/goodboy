import type { SettingsPageScope } from '../../settingsFocus';
import { SettingsRailHeading } from './SettingsRailHeading';

type Props = {
  readonly scope: SettingsPageScope;
  readonly label: string;
  readonly line: string;
};

export const SettingsRailPlaceholder = ({ scope, label, line }: Props) => (
  <div data-settings-group={scope} className="flex flex-col gap-1">
    <SettingsRailHeading label={label} />
    <p className="px-2 text-meta text-faint-foreground">{line}</p>
  </div>
);
