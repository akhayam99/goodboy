import { useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { EmptyState, appScrollIntoView } from '@goodboy/ui';
import type { ProviderDisplayInfo } from '../../../providers';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { SETTINGS_PANE_ENTRY } from '../../../../settings/components/SettingsStudio/settingsPaneEntry';
import { ProviderDetailBody } from '../../../ProviderDetailBody';
import { USAGE_SECTION_ID } from './UsageGroup/usageSectionId';

type Props = {
  readonly info: ProviderDisplayInfo | null;
  readonly autoConnect: boolean;
  readonly autoUpdate: boolean;
  readonly focusModels?: boolean;
  readonly isUsageFocused?: boolean;
  readonly workspaceId?: WorkspaceId | null;
};

export const ProviderPage = ({
  info,
  autoConnect,
  autoUpdate,
  focusModels = false,
  isUsageFocused = false,
  workspaceId = null,
}: Props) => {
  useEffect(() => {
    if (!isUsageFocused || info === null) {
      return;
    }
    appScrollIntoView({
      element: document.getElementById(USAGE_SECTION_ID),
      block: 'start',
    });
  }, [info, isUsageFocused]);
  if (info === null) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.providers}
          icon={CONCEPT_ICONS.providers}
          title="Select a provider"
          size="page"
          headingLevel={2}
        />
      </div>
    );
  }
  return (
    <ProviderDetailBody
      info={info}
      shouldAutoConnect={autoConnect}
      shouldAutoUpdate={autoUpdate}
      isModelsFocused={focusModels}
      workspaceId={workspaceId}
      animationClassName={SETTINGS_PANE_ENTRY}
    />
  );
};
