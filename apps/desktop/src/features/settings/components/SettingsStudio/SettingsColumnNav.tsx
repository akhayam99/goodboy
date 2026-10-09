import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { EmptyLine, ScrollFade, SearchField, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
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
      <button
        type="button"
        onClick={onBack}
        className={cn(
          'group flex h-7 w-full shrink-0 items-center gap-2 rounded-md px-2 text-row text-muted-foreground motion-safe:transition-colors',
          'hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        )}
      >
        <ChevronLeft size={ICON_SIZE.control} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">Back to app</span>
        <span aria-hidden className="shrink-0 text-chip text-faint-foreground">
          Esc
        </span>
      </button>
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
            {results.map((entry) => {
              const Icon = entry.icon;
              return (
                <div role="listitem" key={entry.key}>
                  <SettingsNavRow
                    level="group"
                    icon={<Icon size={ICON_SIZE.control} />}
                    label={entry.label}
                    onClick={() => {
                      setQuery('');
                      entry.run();
                    }}
                  />
                </div>
              );
            })}
            {results.length === 0 ? (
              <EmptyLine className="px-2">No settings match</EmptyLine>
            ) : null}
          </div>
        ) : null}
      </ScrollFade>
    </div>
  );
};
