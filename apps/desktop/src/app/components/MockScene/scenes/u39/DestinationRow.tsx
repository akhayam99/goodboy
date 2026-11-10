import { KeyHint } from '@goodboy/ui';
import type { PaletteEntry } from '../../../../../features/palette/types';
import { SHORTCUTS, shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import type { Destination, DestinationHome } from '../../../../../shared/navigation/destinations';
import { MENU_ACTIONS } from '../../../../hooks/useMenuCommands/menuActions';
import { COLUMN_DOORS } from '../../../SideColumn/columnDoors';

type Props = {
  readonly destination: Destination;
  readonly entry: PaletteEntry | undefined;
};

const MENU_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.entries(SHORTCUTS).map(([id, { label }]) => [id, label])),
  ...Object.fromEntries(Object.entries(MENU_ACTIONS).map(([id, { label }]) => [id, label])),
};

const HOME_LABELS: Readonly<Record<DestinationHome, string>> = {
  column: 'column',
  tile: 'tile',
  topBar: 'top bar',
  foot: 'foot',
};

export const DestinationRow = ({ destination, entry }: Props) => {
  const door = COLUMN_DOORS.find((candidate) => candidate.id === destination.id);
  const ColumnIcon = door?.icon ?? destination.icon;
  const columnLabel = door?.label ?? destination.label;
  const PaletteIcon = entry?.icon;
  const { shortcutId, menuId } = destination;
  return (
    <tr data-destination={destination.id}>
      <th scope="row" className="px-3 py-2 text-left text-row">
        {destination.label}
      </th>
      <td className="px-3 py-2">
        <span className="flex items-center gap-2">
          <ColumnIcon aria-hidden className="size-4 shrink-0" />
          {columnLabel}
          {door === undefined && (
            <span className="text-muted-foreground">{HOME_LABELS[destination.home]}</span>
          )}
        </span>
      </td>
      <td className="px-3 py-2">{menuId === undefined ? '' : (MENU_LABELS[menuId] ?? '')}</td>
      <td className="px-3 py-2">
        {entry === undefined || PaletteIcon === undefined ? (
          <span className="text-muted-foreground">no row</span>
        ) : (
          <span className="flex items-center gap-2">
            <PaletteIcon aria-hidden className="size-4 shrink-0" />
            {entry.label}
            {entry.secondary !== undefined && entry.secondary.length > 0 && (
              <span className="text-muted-foreground">{entry.secondary.join(', ')}</span>
            )}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {shortcutId === undefined ? (
          <span className="text-muted-foreground">no key</span>
        ) : (
          <span className="flex items-center gap-2">
            {SHORTCUTS[shortcutId].label}
            <KeyHint keys={shortcutGlyphs(shortcutId)} />
          </span>
        )}
      </td>
    </tr>
  );
};
