import type { WorkspaceId } from '@kay-am/types';
import { Button, Dialog } from '@kay-am/ui';
import { SkillsPanel } from './SkillsPanel';
import { PhasesPanel } from './PhasesPanel';

interface WorkspaceSettingsDialogProps {
  workspaceId: WorkspaceId;
  workspaceName: string;
  open: boolean;
  onClose: () => void;
}

export function WorkspaceSettingsDialog({
  workspaceId,
  workspaceName,
  open,
  onClose,
}: WorkspaceSettingsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${workspaceName} — settings`}
      description="per-workspace skills and phase templates."
      size="lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          close
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <SkillsPanel workspaceId={workspaceId} />
        <div className="border-t border-border-soft pt-4">
          <PhasesPanel workspaceId={workspaceId} />
        </div>
      </div>
    </Dialog>
  );
}
