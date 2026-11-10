import { destinationOf } from '../../../shared/navigation/destinationOf';
import { GoodboyChip } from '../GoodboyChip';
import { ColumnDoorRow } from './ColumnDoorRow';
import { ReportBugButton } from './ReportBugButton';
import type { ColumnActions } from './columnDoors';
import type { ColumnPlace } from '../../../shared/navigation/columnPlace';

const SETTINGS = destinationOf({ id: 'settings' });

const SETTINGS = destinationOf({ id: 'settings' });

const SETTINGS = destinationOf({ id: 'settings' });

const SETTINGS = destinationOf({ id: 'settings' });

const SETTINGS = destinationOf({ id: 'settings' });

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
      icon={SETTINGS.icon}
      label={SETTINGS.label}
      {...(SETTINGS.shortcutId !== undefined && { shortcut: SETTINGS.shortcutId })}
      isCurrent={place === 'settings'}
      onSelect={() => {
        actions.openSettings();
        onNavigate?.();
      }}
    />
    <GoodboyChip
      variant="column"
      isPrimary={isPrimary}
      isCurrent={place === 'guide' || place === 'whatsNew'}
      onOpenChangelog={actions.openChangelog}
      onOpenGuide={actions.openGuide}
      onOpenShortcuts={actions.openShortcuts}
    />
  </div>
);
