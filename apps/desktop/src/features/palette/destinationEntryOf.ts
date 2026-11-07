import type { SessionId } from '@goodboy/types';
import { SHORTCUTS } from '../../shared/keyboard/registry';
import { formerNamesOf } from '../../shared/utils/names';
import { isProviderListLens } from '../../store/slices/navigation/isProviderListLens';
import { destinationIconOf } from '../session/destinationIconOf';
import type { LensDestination } from '../session/lens-destinations';
import { openDestination } from '../session/openDestination';
import type { PaletteEntry } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly destination: LensDestination;
};

export const destinationEntryOf = ({ sessionId, destination }: Params): PaletteEntry => {
  const name = SHORTCUTS[destination.shortcut].label;
  const verb = isProviderListLens({ lens: destination.lens }) ? 'Link work from' : 'Open';
  return {
    key: `lens:${destination.pane ?? destination.lens ?? 'overview'}`,
    label: `${verb} ${name}`,
    kind: 'page',
    group: 'action',
    icon: destinationIconOf({ destination }),
    shortcut: destination.shortcut,
    secondary: formerNamesOf(name),
    run: () => openDestination({ sessionId, destination }),
  };
};
