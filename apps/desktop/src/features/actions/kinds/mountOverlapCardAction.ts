import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/utils/names';
import { requestOverlapCard } from '../../overlap/openOverlapCard';
import type { ActionDefinition } from '../types';
import type { MountFacts } from './mountFacts';

export const MOUNT_OVERLAP_CARD_ACTION: ActionDefinition<MountFacts> = {
  id: 'mount.mergeOrder',
  label: ({ facts }) => `${NAMES.mergeOrder} (${facts.overlapCount ?? 0})`,
  shortLabel: () => NAMES.mergeOrder,
  icon: CONCEPT_ICONS.pr,
  group: 'open',
  when: ({ facts }) => (facts.overlapCount ?? 0) > 0 && !facts.isClosed && facts.pr !== 'merged',
  run: ({ facts }) => requestOverlapCard({ mountId: facts.mountId }),
};
