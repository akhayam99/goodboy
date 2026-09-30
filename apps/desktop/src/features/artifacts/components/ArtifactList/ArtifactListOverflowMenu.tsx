import { FolderOpen } from 'lucide-react';
import { OverflowMenu } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openArtifactsFolder } from '../../artifactMirror/artifactMirrorInvoke';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Props = {
  readonly sessionId: SessionId;
};

export const ArtifactListOverflowMenu = ({ sessionId }: Props) => {
  const workspaceSlug = useAppStore((s) => {
    const workspaceId = sessionById(s.sessions, sessionId)?.workspaceId;
    return s.workspaces.find((workspace) => workspace.id === workspaceId)?.slug ?? null;
  });

  return (
    <OverflowMenu
      label="More"
      tooltip="More actions"
      items={[
        {
          kind: 'item',
          key: 'open-artifacts-folder',
          label: 'Open artifacts folder',
          icon: FolderOpen,
          disabled: workspaceSlug === null,
          onClick: () => {
            if (workspaceSlug !== null) {
              void openArtifactsFolder({ workspaceSlug });
            }
          },
        },
      ]}
    />
  );
};
