import { useMemo } from 'react';
import { EmptyLine, PANE_RHYTHM, cn } from '@goodboy/ui';

import { SettingsNavRow } from '../../../../../shared/components/SettingsNavRow';
import { settingsPaletteEntries } from '../../../settingsPaletteEntries';
import type { SettingsFocus } from '../../../settingsFocus';
import type { SettingsGroup } from '../settingsDirectory';

type Props = {
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly query: string;
  readonly onOpen: (focus: SettingsFocus) => void;
  readonly onPicked: () => void;
};

type MatchParams = {
  readonly text: string;
  readonly query: string;
};

const matches = ({ text, query }: MatchParams): boolean =>
  text.toLowerCase().includes(query.trim().toLowerCase());

export const SettingsSearchResults = ({ groups, query, onOpen, onPicked }: Props) => {
  const results = useMemo(
    () =>
      settingsPaletteEntries({ groups, open: onOpen }).filter(
        (entry) =>
          matches({ text: entry.label, query }) ||
          (entry.secondary ?? []).some((name) => matches({ text: name, query })),
      ),
    [groups, onOpen, query],
  );

  return (
    <div
      role="list"
      aria-label="Matching settings"
      className={cn('flex flex-col gap-0.5', PANE_RHYTHM.navRail.body)}
    >
      {results.map((entry) => (
        <div role="listitem" key={entry.key}>
          <SettingsNavRow
            label={entry.label}
            onClick={() => {
              onPicked();
              entry.run();
            }}
          />
        </div>
      ))}
      {results.length === 0 ? <EmptyLine className="px-2">No settings match</EmptyLine> : null}
    </div>
  );
};
