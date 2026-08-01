import { useState } from 'react';
import { Dialog } from '@goodboy/ui';
import { WorkspaceLinkForm } from '../WorkspaceLinkForm';

type Props = {
  readonly open: boolean;
  readonly onClose: () => void;
};

export const WorkspaceLinkDialog = ({ open, onClose }: Props) => {
  const [footerContainer, setFooterContainer] = useState<HTMLElement | null>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Add workspace"
      description="Add a project, link projects, or create a standalone workspace."
      footer={<div ref={setFooterContainer} className="contents" />}
    >
      {open ? (
        <WorkspaceLinkForm
          onComplete={onClose}
          onCancel={onClose}
          showBreadcrumb
          modes={['single', 'multi', 'simple']}
          footerContainer={footerContainer}
        />
      ) : null}
    </Dialog>
  );
};
