import { Eyebrow } from '@goodboy/ui';
import type { SettingsPageScope } from '../../settingsFocus';

type Props = {
  readonly scope: SettingsPageScope;
  readonly label: string;
  readonly line: string;
};

export const SettingsRailPlaceholder = ({ scope, label, line }: Props) => (
  <div data-settings-group={scope} className="flex flex-col gap-1 px-2">
    <h2 className="flex h-6 items-center">
      <Eyebrow muted label={label} />
    </h2>
    <p className="text-meta text-faint-foreground">{line}</p>
  </div>
);
