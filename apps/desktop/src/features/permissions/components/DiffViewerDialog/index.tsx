import { FileEdit } from 'lucide-react';
import { Dialog } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { DiffViewerContent } from './DiffViewerContent';

type DiffViewerContentProps = {
  onClose: () => void;
  sessionId?: SessionId;
  title?: string;
  loader?: () => Promise<string>;
  repoSlug?: string;
  prNumber?: number;
  cwd?: string;
  workingDir?: string;
  worktreePath?: string;
  jumpToFirstCommented?: boolean;
  jumpToFile?: string;
  showToolbarClose?: boolean;
};

type DiffViewerDialogProps = DiffViewerContentProps & {
  open: boolean;
};

type DiffViewerPaneProps = DiffViewerContentProps & {
  workspaceName: string;
};

export const DiffViewerDialog = ({ open, ...rest }: DiffViewerDialogProps) => (
  <Dialog
    open={open}
    onClose={rest.onClose}
    size="xl"
    fixedHeightClass="h-[92vh] max-w-[1400px]"
    className="w-[92vw] max-w-[1400px]"
    showClose={false}
    bodyClassName=""
  >
    {open ? <DiffViewerContent {...rest} /> : null}
  </Dialog>
);

export const DiffViewerPane = ({ workspaceName, onClose, ...rest }: DiffViewerPaneProps) => (
  <StudioShell
    icon={FileEdit}
    title="Diff"
    workspaceName={workspaceName}
    closeLabel="Overview"
    onClose={onClose}
    variant="slot"
  >
    {(requestClose) => (
      <DiffViewerContent {...rest} onClose={requestClose} showToolbarClose={false} />
    )}
  </StudioShell>
);
