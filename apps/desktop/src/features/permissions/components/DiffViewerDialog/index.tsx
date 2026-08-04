import type { ReactNode } from 'react';
import { Dialog } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { DiffFocus } from '../../../../store';
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
  diffFocus?: DiffFocus | null;
  showToolbarClose?: boolean;
};

type DiffViewerDialogProps = DiffViewerContentProps & {
  open: boolean;
};

type DiffViewerPaneProps = DiffViewerContentProps & {
  readonly paneActions?: ReactNode;
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

export const DiffViewerPane = ({ onClose, ...rest }: DiffViewerPaneProps) => (
  <DiffViewerContent {...rest} onClose={onClose} presentation="pane" showToolbarClose={false} />
);
