import type { ReactNode } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { SkillsPanel } from '../../../skills/components/SkillsPanel';
import { PermissionsSettings } from '../../../permissions/components/PermissionsSettings';
import { WorkspaceStorageNotice } from '../../../storage/components/WorkspaceStorageNotice';
import { storageWorkspacePages } from '../../../storage/storageWorkspacePages';
import { WorkspaceAfterMergeSection } from './WorkspaceAfterMergeSection';
import { WorkspaceProfileSection } from './WorkspaceProfileSection';
import { WorkspaceProjectsSection } from './WorkspaceProjectsSection';
import { WorkspaceDefaultsGrid } from './WorkspaceDefaultsGrid';
import { WorkspaceReviewRepliesSection } from './WorkspaceReviewRepliesSection';
import { WorkspaceNameBand } from './WorkspaceNameBand';
import { WorkspaceDisconnectBand } from './WorkspaceDisconnectBand';
import { WorkspaceFieldRow } from './WorkspaceFieldRow';
import { FolderGitBand } from '../../../workspace/folderGitBand';
import { isTrackWithGitSection, type WorkspacePage } from './workspacePages';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly page: WorkspacePage;
  readonly section?: string;
  readonly requestClose: () => void;
};

export const WorkspacePageBody = ({
  workspaceId,
  page,
  section,
  requestClose,
}: Props): ReactNode => {
  switch (page) {
    case 'projects':
      return (
        <>
          <WorkspaceNameBand workspaceId={workspaceId} />
          <WorkspaceProjectsSection workspaceId={workspaceId} />
          <FolderGitBand
            workspaceId={workspaceId}
            isInitiallyOpen={isTrackWithGitSection({ section })}
          />
          <WorkspaceStorageNotice workspaceId={workspaceId} />
          <WorkspaceDisconnectBand workspaceId={workspaceId} requestClose={requestClose} />
        </>
      );
    case 'profile':
      return <WorkspaceProfileSection workspaceId={workspaceId} />;
    case 'general':
      return <WorkspaceDefaultsGrid workspaceId={workspaceId} />;
    case 'branches':
      return (
        <>
          <WorkspaceAfterMergeSection workspaceId={workspaceId} />
          {storageWorkspacePages({ workspaceId }).branches.body}
        </>
      );
    case 'review-replies':
      return <WorkspaceReviewRepliesSection workspaceId={workspaceId} />;
    case 'permissions':
      return (
        <PermissionsSettings
          workspaceId={workspaceId}
          renderDefaultRow={(control) => (
            <WorkspaceFieldRow workspaceId={workspaceId} field="permissionMode" layout="stacked">
              {control}
            </WorkspaceFieldRow>
          )}
        />
      );
    case 'skills':
      return <SkillsPanel workspaceId={workspaceId} />;
    default: {
      const exhaustive: never = page;
      return exhaustive;
    }
  }
};
