import { useRef } from 'react';
import { PanelRight } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import type { ArtifactDrawerTab } from '../../../../store/slices/drawer/state';

type Props = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export const ArtifactDrawerToggles = ({ sessionId, artifactId }: Props) => {
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);
  const lastTab = useRef<ArtifactDrawerTab>('details');
  const openTab = useAppStore((s): ArtifactDrawerTab | null => {
    const drawer = selectOpenDrawer(s);
    if (drawer === null || drawer.kind !== 'artifact' || drawer.payload.artifactId !== artifactId) {
      return null;
    }
    return drawer.payload.tab;
  });
  if (openTab !== null) {
    lastTab.current = openTab;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={openTab !== null}
      title="Where this came from, its sources and scouts"
      data-testid="artifact-drawer-details"
      onClick={() =>
        toggleDrawer({
          kind: 'artifact',
          sessionId,
          payload: { artifactId, tab: openTab ?? lastTab.current },
        })
      }
    >
      <PanelRight size={ICON_SIZE.row} aria-hidden />
      Details
    </Button>
  );
};
