import { useEffect } from 'react';
import { Settings2 } from 'lucide-react';
import { Divider } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { WorkspaceScopePanel } from '../../../settings/components/SettingsStudio/WorkspaceScopePanel';
import { OverlayHeader } from '../../../../shared/components/OverlayHeader';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly initialSection?: string;
  readonly onClose: () => void;
};

export const WorkspaceSettingsPane = ({
  workspaceId,
  workspaceName,
  initialSection,
  onClose,
}: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  return (
    <div className="flex h-full w-full flex-col bg-background motion-safe:animate-studio-in">
      <OverlayHeader
        icon={Settings2}
        title="Workspace settings"
        subtitle={workspaceName}
        onClose={onClose}
        closeLabel="close workspace settings"
      />
      <Divider />
      <div className="min-h-0 flex-1">
        <WorkspaceScopePanel
          workspaceId={workspaceId}
          initialSection={initialSection}
          requestClose={onClose}
        />
      </div>
    </div>
  );
};
