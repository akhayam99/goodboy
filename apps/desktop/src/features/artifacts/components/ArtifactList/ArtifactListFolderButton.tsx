import { FolderOpen } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openArtifactsFolder } from '../../artifactMirror/artifactMirrorInvoke';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Props = {
  readonly sessionId: SessionId;
};

export const ArtifactListFolderButton = ({ sessionId }: Props) => {
  const workspaceSlug = useAppStore((s) => {
    const workspaceId = sessionById(s.sessions, sessionId)?.workspaceId;
    return s.workspaces.find((workspace) => workspace.id === workspaceId)?.slug ?? null;
  });

  return (
    <IconButton
      icon={FolderOpen}
      label="Show in Finder"
      size="sm"
      disabled={workspaceSlug === null}
      onClick={() => {
        if (workspaceSlug !== null) {
          void openArtifactsFolder({ workspaceSlug });
        }
      }}
    />
  );
};
