import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Search } from '@goodboy/ui/icons';
import {
  IconButton,
  ScrollFade,
  SearchField,
  StudioRailLayout,
  useStudioRailFold,
  type StudioRailPlacement,
} from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import type { SettingsFocus, SettingsScopeChange } from '../../../settingsFocus';
import type { SettingsGroup } from '../settingsDirectory';
import { SettingsRail } from '../SettingsRail';
import { SettingsSearchResults } from '../SettingsSearchResults';
import { useSettingsSearch } from '../../../hooks/useSettingsSearch';
import { settingsSearchHitId } from '../../../settingsSearchHitId';

const SETTINGS_RAIL_FOLDED_BY_DEFAULT_BELOW = 1200;

type Props = {
  readonly pageKey: string | null;
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly workspaceName: string | null;
  readonly onScopeChange: (params: SettingsScopeChange) => void;
  readonly placement: StudioRailPlacement;
  readonly detail: ReactNode;
};

export const SettingsScopesLayout = ({
  pageKey,
  groups,
  workspaceName,
  onScopeChange,
  placement,
  detail,
}: Props) => {
  const fold = useStudioRailFold({
    surface: 'settings',
    foldedByDefaultBelow: SETTINGS_RAIL_FOLDED_BY_DEFAULT_BELOW,
  });
  const [query, setQuery] = useState('');
  const [isSearchAsked, setIsSearchAsked] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const isSearching = query.trim() !== '';
  const amendStudio = useAppStore((state) => state.amendStudio);
  const openFocus = useCallback(
    (next: SettingsFocus) => amendStudio({ studio: { kind: 'settings', focus: next } }),
    [amendStudio],
  );
  const listId = useId();
  const search = useSettingsSearch({
    groups,
    query,
    onOpen: openFocus,
    onClear: () => setQuery(''),
  });
  const activeHitId =
    isSearching && search.hits.length > 0
      ? settingsSearchHitId({ listId, index: search.activeIndex })
      : undefined;

  useEffect(() => {
    if (!isSearchAsked || fold.isCollapsed) {
      return;
    }
    searchRef.current?.focus();
    setIsSearchAsked(false);
  }, [isSearchAsked, fold.isCollapsed]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <StudioRailLayout
        railLabel="Settings scopes"
        railWidth="narrow"
        surface="settings"
        placement={placement}
        isCollapsed={fold.isCollapsed}
        onCollapsedChange={fold.setFolded}
        railHeader={
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search settings"
            ariaLabel="Search settings"
            autoComplete="off"
            spellCheck={false}
            inputRef={searchRef}
            className="min-w-0 flex-1"
            aria-controls={isSearching ? listId : undefined}
            aria-activedescendant={activeHitId}
            onKeyDown={(event) => search.keyDown({ event })}
          />
        }
        foldedActions={
          <IconButton
            icon={Search}
            label="Search settings"
            tooltipSide="right"
            onClick={() => {
              fold.setFolded(false);
              setIsSearchAsked(true);
            }}
          />
        }
        rail={
          <ScrollFade className="min-h-0 flex-1" fadeFrom="background">
            <div hidden={isSearching}>
              <SettingsRail
                pageKey={pageKey}
                groups={groups}
                workspaceName={workspaceName}
                onSelect={onScopeChange}
              />
            </div>
            {isSearching ? (
              <SettingsSearchResults
                listId={listId}
                query={query}
                hits={search.hits}
                activeIndex={search.activeIndex}
                onPick={search.pick}
              />
            ) : null}
          </ScrollFade>
        }
        detail={detail}
        detailClassName="@container"
      />
    </div>
  );
};
