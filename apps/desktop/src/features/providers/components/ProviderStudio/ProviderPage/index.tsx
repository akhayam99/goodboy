import { useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { EmptyState } from '@goodboy/ui';
import type { ProviderDisplayInfo } from '../../../providers';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { ProviderPageBody } from './ProviderPageBody';
import { USAGE_SECTION_ID } from './UsageGroup/usageSectionId';

type Props = {
  readonly info: ProviderDisplayInfo | null;
  readonly autoConnect: boolean;
  readonly autoUpdate: boolean;
  readonly focusModels?: boolean;
  readonly isUsageFocused?: boolean;
  readonly workspaceId?: WorkspaceId | null;
  readonly scopeLabel?: string | null;
};

export const ProviderPage = ({
  info,
  autoConnect,
  autoUpdate,
  focusModels = false,
  isUsageFocused = false,
  workspaceId = null,
  scopeLabel = null,
}: Props) => {
  useEffect(() => {
    if (!isUsageFocused || info === null) {
      return;
    }
    document.getElementById(USAGE_SECTION_ID)?.scrollIntoView?.({ block: 'start' });
  }, [info, isUsageFocused]);
  if (info === null) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.providers}
          icon={CONCEPT_ICONS.providers}
          title="Select a provider"
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }
  return (
    <ProviderPageBody
      info={info}
      autoConnect={autoConnect}
      autoUpdate={autoUpdate}
      focusModels={focusModels}
      workspaceId={workspaceId}
      scopeLabel={scopeLabel}
    />
  );
};
