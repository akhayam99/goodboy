import { destinationOf } from '../../shared/navigation/destinationOf';
import type { FootDestinationId } from '../../shared/navigation/destinations';
import { openDestination } from '../../shared/navigation/openDestination';
import { destinationPaletteKeyOf } from './destinationPaletteKeyOf';
import type { PaletteEntry } from './types';

type Params = {
  readonly id: FootDestinationId;
};

const FOOT_PLACEMENT = {
  settings: { kind: 'goto', group: 'action' },
  guide: { kind: 'help', group: 'help' },
  whatsNew: { kind: 'help', group: 'help' },
} as const satisfies Record<FootDestinationId, Pick<PaletteEntry, 'kind' | 'group'>>;

export const footDestinationEntryOf = ({ id }: Params): PaletteEntry => {
  const destination = destinationOf({ id });
  return {
    key: destinationPaletteKeyOf({ id }),
    ...FOOT_PLACEMENT[id],
    label: destination.label,
    ...(destination.aliases.length > 0 && { secondary: destination.aliases }),
    icon: destination.icon,
    ...(destination.shortcutId !== undefined && { shortcut: destination.shortcutId }),
    run: () => openDestination({ id }),
  };
};
