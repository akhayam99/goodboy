import type { DestinationId, FootDestinationId } from '../../shared/navigation/destinations';

type Params = {
  readonly id: DestinationId;
};

const FOOT_KEYS = {
  settings: 'action:settings',
  guide: 'help:guide',
  whatsNew: 'goto:changelog',
} as const satisfies Record<FootDestinationId, string>;

export const destinationPaletteKeyOf = ({ id }: Params): string =>
  id === 'settings' || id === 'guide' || id === 'whatsNew' ? FOOT_KEYS[id] : `goto:${id}`;
