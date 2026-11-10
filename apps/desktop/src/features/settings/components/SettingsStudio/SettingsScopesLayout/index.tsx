import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
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

const SETTINGS_RAIL_FOLD_BELOW = 720;
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
    foldBelow: SETTINGS_RAIL_FOLD_BELOW,
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

  useEffect(() => {
    if (!isSearchAsked || fold.isCollapsed) {
      return;
    }
    searchRef.current?.focus();
    setIsSearchAsked(false);
  }, [isSearchAsked, fold.isCollapsed]);

  return (
    <div ref={fold.paneRef} className="flex h-full min-h-0 min-w-0 flex-1">
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
                groups={groups}
                query={query}
                onOpen={openFocus}
                onPicked={() => setQuery('')}
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
