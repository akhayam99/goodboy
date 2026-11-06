import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { LensDestination } from './lens-destinations';
import { LENS_ICON } from './lens-labels';

type Params = {
  readonly destination: LensDestination;
};

export const destinationIconOf = ({ destination }: Params): LucideIcon => {
  if (destination.pane !== undefined) {
    return CONCEPT_ICONS[destination.pane];
  }
  const lens = destination.lens ?? null;
  return lens === null ? CONCEPT_ICONS.sessions : LENS_ICON[lens];
};
