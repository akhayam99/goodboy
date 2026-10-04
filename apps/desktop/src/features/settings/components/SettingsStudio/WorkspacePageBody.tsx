import type { ReactNode } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { SkillsPanel } from '../../../skills/components/SkillsPanel';
import { PermissionsSettings } from '../../../permissions/components/PermissionsSettings';
import { WorkspaceStorageNotice } from '../../../storage/components/WorkspaceStorageNotice';
import type { SettingsScopeChange } from '../../settingsFocus';
import { WorkspaceAfterMergeSection } from './WorkspaceAfterMergeSection';
import { WorkspaceProfileSection } from './WorkspaceProfileSection';
import { WorkspaceProjectsSection } from './WorkspaceProjectsSection';
import { WorkspaceDefaultsGrid } from './WorkspaceDefaultsGrid';
import { WorkspaceReviewRepliesSection } from './WorkspaceReviewRepliesSection';
import { WorkspaceNameBand } from './WorkspaceNameBand';
import { WorkspaceDisconnectBand } from './WorkspaceDisconnectBand';
import { WorkspaceDevProjectBand } from './WorkspaceDevProjectBand';
import { WorkspaceFieldRow } from './WorkspaceFieldRow';
import { DEV_PROJECT_SECTION_ID, type WorkspacePage } from './workspacePages';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly page: WorkspacePage;
  readonly section?: string;
  readonly onSelect: (change: SettingsScopeChange) => void;
  readonly requestClose: () => void;
};

export const WorkspacePageBody = ({
  workspaceId,
  page,
  section,
  onSelect,
  requestClose,
}: Props): ReactNode => {
  switch (page) {
    case 'projects':
      return (
        <>
          <WorkspaceNameBand workspaceId={workspaceId} />
          <WorkspaceProjectsSection workspaceId={workspaceId} />
          <WorkspaceDevProjectBand
            workspaceId={workspaceId}
            isInitiallyOpen={section === DEV_PROJECT_SECTION_ID}
          />
          <WorkspaceStorageNotice workspaceId={workspaceId} />
        </>
      );
    case 'profile':
      return <WorkspaceProfileSection workspaceId={workspaceId} />;
    case 'general':
      return <WorkspaceDefaultsGrid workspaceId={workspaceId} />;
    case 'after-merge':
      return <WorkspaceAfterMergeSection workspaceId={workspaceId} />;
    case 'review-replies':
      return (
        <WorkspaceReviewRepliesSection
          workspaceId={workspaceId}
          onEditAttribution={() => onSelect({ scope: 'workspace', section: 'general' })}
        />
      );
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
    case 'danger':
      return <WorkspaceDisconnectBand workspaceId={workspaceId} requestClose={requestClose} />;
    default: {
      const exhaustive: never = page;
      return exhaustive;
    }
  }
};
