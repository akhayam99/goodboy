import { MessageSquare, PanelRight } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import type { ArtifactDrawerTab } from '../../../../store/slices/drawer/state';

type Props = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export const ArtifactDrawerToggles = ({ sessionId, artifactId }: Props) => {
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);
  const openTab = useAppStore((s): ArtifactDrawerTab | null => {
    const drawer = selectOpenDrawer(s);
    if (drawer === null || drawer.kind !== 'artifact' || drawer.payload.artifactId !== artifactId) {
      return null;
    }
    return drawer.payload.tab;
  });
  const toggle = (tab: ArtifactDrawerTab) =>
    toggleDrawer({ kind: 'artifact', sessionId, payload: { artifactId, tab } });

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <IconButton
        variant="ghost"
        icon={MessageSquare}
        label="Chat"
        tooltip="Talk to the agent about this artifact"
        aria-pressed={openTab === 'chat'}
        onClick={() => toggle('chat')}
        data-testid="artifact-drawer-chat"
      />
      <IconButton
        variant="ghost"
        icon={PanelRight}
        label="Details"
        tooltip="Where this came from, its sources and scouts"
        aria-pressed={openTab === 'details'}
        onClick={() => toggle('details')}
        data-testid="artifact-drawer-details"
      />
    </span>
  );
};
