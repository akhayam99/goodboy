import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { GoodboyChip } from '../GoodboyChip';
import { ColumnDoorRow } from './ColumnDoorRow';
import { ReportBugButton } from './ReportBugButton';
import type { ColumnActions } from './columnDoors';
import type { ColumnPlace } from './columnPlace';

type Props = {
  readonly place: ColumnPlace;
  readonly isPrimary: boolean;
  readonly actions: ColumnActions;
  readonly onNavigate?: () => void;
};

export const ColumnFoot = ({ place, isPrimary, actions, onNavigate }: Props) => (
  <div data-column-foot="" className="flex shrink-0 flex-col gap-0.5 px-2">
    <ColumnDoorRow
      id="settings"
      icon={CONCEPT_ICONS.settings}
      label="Settings"
      shortcut={shortcutGlyphs('settings.open')}
      isCurrent={place === 'settings'}
      onSelect={() => {
        actions.openSettings();
        onNavigate?.();
      }}
    />
    <div className="flex min-w-0 items-center gap-1">
      <GoodboyChip
        variant="column"
        isPrimary={isPrimary}
        onOpenChangelog={actions.openChangelog}
        onOpenShortcuts={actions.openShortcuts}
      />
      <ReportBugButton />
    </div>
  </div>
);
