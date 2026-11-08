import type { ReactNode } from 'react';
import {
  ScrollFade,
  SelectableRow,
  StudioRailLayout,
  useStudioRailFold,
  appScrollIntoView,
} from '@goodboy/ui';
import { StudioDetail } from '../../../shared/components/StudioShell/StudioDetail';
import { useAppStore } from '../../../store';
import { SHORTCUT_GROUP_LABEL } from '../../../features/settings/components/SettingsStudio/shortcutGroupLabel';
import { SHORTCUT_COLUMNS } from '../../../features/settings/components/SettingsStudio/shortcutRows';
import { ShortcutsSheet } from './ShortcutsSheet';

type Props = {
  readonly header: ReactNode;
  readonly results: ReactNode | null;
};

export const ShortcutsTab = ({ header, results }: Props) => {
  const fold = useStudioRailFold({ surface: 'guide' });
  const openStudio = useAppStore((state) => state.openStudio);

  return (
    <StudioRailLayout
      railLabel="Shortcut groups"
      railWidth="standard"
      surface="guide"
      placement="page"
      isCollapsed={fold.isCollapsed}
      onCollapsedChange={fold.setFolded}
      rail={
        <nav aria-label="Shortcut groups" className="flex min-h-0 flex-1 flex-col gap-2">
          {header}
          <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
            <div className="flex flex-col gap-0.5 px-3 pb-3">
              {results ??
                SHORTCUT_COLUMNS.flat().map((group) => (
                  <SelectableRow
                    key={group}
                    selected={false}
                    onClick={() =>
                      appScrollIntoView({
                        element: document.getElementById(`help-shortcuts-${group}`),
                        block: 'start',
                      })
                    }
                    className="items-center px-2 py-1 text-ui"
                  >
                    <span className="min-w-0 flex-1 truncate">{SHORTCUT_GROUP_LABEL[group]}</span>
                  </SelectableRow>
                ))}
            </div>
          </ScrollFade>
        </nav>
      }
      detail={
        <StudioDetail>
          <ShortcutsSheet
            onCustomize={() =>
              openStudio({
                studio: { kind: 'settings', focus: { scope: 'app', section: 'shortcuts' } },
              })
            }
          />
        </StudioDetail>
      }
    />
  );
};
