import { useEffect, useRef, useState } from 'react';
import { PaneShell, SectionHeader } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { SettingsGroup, SettingsPage } from './settingsDirectory';
import { SettingsHomeCard } from './SettingsHomeCard';
import { SETTINGS_PANE_ENTRY } from './settingsPaneEntry';
import { readLastSettingsPage } from './lastSettingsPage';

type Props = {
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly onOpen: (page: SettingsPage) => void;
};

export const SettingsHome = ({ groups, onOpen }: Props) => {
  const [lastPageKey] = useState(readLastSettingsPage);
  const focusRef = useRef<HTMLButtonElement | null>(null);
  const pages = groups.flatMap((group) => group.pages);
  const focusKey = pages.some((page) => page.key === lastPageKey)
    ? lastPageKey
    : (pages[0]?.key ?? null);

  useEffect(() => {
    focusRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <PaneShell
      animationClassName={SETTINGS_PANE_ENTRY}
      title="Settings"
      meta="Pick a page. The list moves to the left and stays there."
    >
      <div className="flex flex-col gap-6">
        {groups.map((group) => {
          const Icon = CONCEPT_ICONS[group.concept];
          return (
            <section
              key={group.scope}
              aria-label={group.label}
              data-settings-group={group.scope}
              className="flex flex-col gap-2"
            >
              <SectionHeader
                label={group.label}
                headingLevel={2}
                icon={<Icon size={ICON_SIZE.row} aria-hidden />}
                meta={<span className="text-secondary text-faint-foreground">{group.place}</span>}
              />
              <ul
                aria-label={`${group.label} pages`}
                className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-1.5"
              >
                {group.pages.map((page) => (
                  <li key={page.key} className="flex min-w-0">
                    <SettingsHomeCard
                      page={page}
                      isLastOpened={page.key === lastPageKey}
                      {...(page.key === focusKey && { buttonRef: focusRef })}
                      onOpen={onOpen}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </PaneShell>
  );
};
