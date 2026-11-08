import type { SessionArtifact } from '@goodboy/types';
import { DrawerBackChip } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { OpenDrawer } from '../../../store/slices/drawer/state';
import { slotChipLabelOf } from './slotChipLabelOf';

const NO_ARTIFACTS: ReadonlyArray<SessionArtifact> = [];

type Props = {
  readonly back: OpenDrawer;
};

export const SlotBackChip = ({ back }: Props) => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[back.sessionId] ?? NO_ARTIFACTS);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const { kind, title } = slotChipLabelOf({ drawer: back, artifacts });
  return <DrawerBackChip kind={kind} title={title} onBack={() => openDrawer(back)} />;
};
