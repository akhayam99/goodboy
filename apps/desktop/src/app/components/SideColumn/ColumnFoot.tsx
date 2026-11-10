import { destinationOf } from '../../../shared/navigation/destinationOf';
import { GoodboyChip } from '../GoodboyChip';
import { ColumnDoorRow } from './ColumnDoorRow';
import { ReportBugButton } from './ReportBugButton';
import type { ColumnActions } from './columnDoors';
import type { ColumnPlace } from './columnPlace';

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
    <div data-column-corner="" className="@container flex min-w-0 items-center gap-1">
      <GoodboyChip
        variant="column"
        isPrimary={isPrimary}
        isCurrent={place === 'help'}
        onOpenChangelog={() => {
          actions.openChangelog();
          onNavigate?.();
        }}
        onOpenHelp={() => {
          actions.openGuide();
          onNavigate?.();
        }}
      />
      <ReportBugButton />
    </div>
  </div>
);
