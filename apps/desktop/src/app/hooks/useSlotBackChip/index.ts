import { useMemo } from 'react';
import type { SessionArtifact } from '@goodboy/types';
import type { DrawerChip } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { OpenDrawer } from '../../../store/slices/drawer/state';
import { slotChipLabelOf } from './slotChipLabelOf';

const NO_ARTIFACTS: ReadonlyArray<SessionArtifact> = [];

type Params = {
  readonly back: OpenDrawer | null;
};

export const useSlotBackChip = ({ back }: Params): DrawerChip | null => {
  const artifacts = useAppStore((s) =>
    back === null || back.sessionId === null
      ? NO_ARTIFACTS
      : (s.sessionArtifacts[back.sessionId] ?? NO_ARTIFACTS),
  );
  const openDrawer = useAppStore((s) => s.openDrawer);
  return useMemo(() => {
    if (back === null) {
      return null;
    }
    const { kind, title } = slotChipLabelOf({ drawer: back, artifacts });
    return { kind, title, onBack: () => openDrawer(back) };
  }, [back, artifacts, openDrawer]);
};
