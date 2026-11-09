import { KeyHint } from '@goodboy/ui';
import { SHORTCUTS, shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import type { Destination } from '../../../../../shared/navigation/destinations';
import { MENU_ACTIONS } from '../../../../hooks/useMenuCommands/menuActions';
import { COLUMN_DOORS } from '../../../SideColumn/columnDoors';

type Props = {
  readonly destination: Destination;
};

const GO_MENU_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.entries(SHORTCUTS).map(([id, { label }]) => [id, label])),
  ...Object.fromEntries(Object.entries(MENU_ACTIONS).map(([id, { label }]) => [id, label])),
};

export const DestinationRow = ({ destination }: Props) => {
  const door = COLUMN_DOORS.find((candidate) => candidate.id === destination.id);
  const Icon = destination.icon;
  const { shortcutId } = destination;
  return (
    <tr data-destination={destination.id}>
      <th scope="row" className="px-3 py-2 text-left text-row">
        <span className="flex items-center gap-2">
          <Icon aria-hidden className="size-4 shrink-0" />
          {destination.label}
        </span>
      </th>
      <td className="px-3 py-2">{door === undefined ? 'bell' : door.label}</td>
      <td className="px-3 py-2">{GO_MENU_LABELS[destination.menuId] ?? ''}</td>
      <td className="px-3 py-2">
        {destination.label}
        {destination.aliases.length > 0 && (
          <span className="text-muted-foreground"> {destination.aliases.join(', ')}</span>
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
