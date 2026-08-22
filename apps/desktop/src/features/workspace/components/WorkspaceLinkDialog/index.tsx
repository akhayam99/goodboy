import { useState } from 'react';
import { Dialog } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { isWizardDone, reopenWizard } from '../../../onboarding/onboarding-store';
import { validateGitRepo } from '../../../../shared/lib/repo';
import { WorkspaceLinkForm } from '../WorkspaceLinkForm';

type Props = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onOfferRepo: () => void;
};

export const WorkspaceLinkDialog = ({ open, onClose, onOfferRepo }: Props) => {
  const [footerContainer, setFooterContainer] = useState<HTMLElement | null>(null);

  const onComplete = async ({
    mode,
    workspace,
  }: {
    readonly mode: 'single' | 'multi' | 'simple';
    readonly workspace: Workspace;
  }) => {
    onClose();
    if (!isWizardDone()) {
      reopenWizard('setup');
      return;
    }
    if (mode !== 'single' || workspace.sessionsRoot === null) {
      return;
    }
    const check = await validateGitRepo(workspace.sessionsRoot);
    if (check.isRepo === false) {
      onOfferRepo();
    }
  };

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
          onComplete={onComplete}
          onCancel={onClose}
          showBreadcrumb
          modes={['single', 'multi', 'simple']}
          footerContainer={footerContainer}
        />
      ) : null}
    </Dialog>
  );
};
