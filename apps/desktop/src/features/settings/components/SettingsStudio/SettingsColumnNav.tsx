import { useMemo, useState, type ReactNode } from 'react';
import { EmptyLine, ScrollFade, SearchField } from '@goodboy/ui';

import { StudioBackButton } from '../../../../shared/components/StudioShell/StudioBackButton';
import { SettingsNavRow } from '../../../../shared/components/SettingsNavRow';
import { settingsPaletteEntries } from '../../settingsPaletteEntries';
import type { SettingsFocus } from '../../settingsFocus';
import type { SettingsGroup } from './settingsDirectory';

type Props = {
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly rail: ReactNode;
  readonly onBack: () => void;
  readonly onOpen: (focus: SettingsFocus) => void;
};

type MatchParams = {
  readonly text: string;
  readonly query: string;
};

const matches = ({ text, query }: MatchParams): boolean =>
  text.toLowerCase().includes(query.trim().toLowerCase());

export const SettingsColumnNav = ({ groups, rail, onBack, onOpen }: Props) => {
  const [query, setQuery] = useState('');
  const isSearching = query.trim() !== '';
  const results = useMemo(
    () =>
      isSearching
        ? settingsPaletteEntries({ groups, open: onOpen }).filter(
            (entry) =>
              matches({ text: entry.label, query }) ||
              (entry.secondary ?? []).some((name) => matches({ text: name, query })),
          )
        : [],
    [groups, onOpen, query, isSearching],
  );

  return (
    <div data-settings-column="" className="flex min-h-0 flex-1 flex-col gap-2">
      <StudioBackButton isFullWidth onBack={onBack} />
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search settings"
        ariaLabel="Search settings"
        autoComplete="off"
        spellCheck={false}
        className="shrink-0"
      />
      <ScrollFade className="min-h-0 flex-1">
        <div hidden={isSearching}>{rail}</div>
        {isSearching ? (
          <div role="list" aria-label="Matching settings" className="flex flex-col gap-0.5 py-1">
            {results.map((entry) => (
              <div role="listitem" key={entry.key}>
                <SettingsNavRow
                  label={entry.label}
                  onClick={() => {
                    setQuery('');
                    entry.run();
                  }}
                />
              </div>
            ))}
            {results.length === 0 ? (
              <EmptyLine className="px-2">No settings match</EmptyLine>
            ) : null}
          </div>
        ) : null}
      </ScrollFade>
    </div>
  );
};
