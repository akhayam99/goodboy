import { LayoutTemplate } from 'lucide-react';
import type { OverflowMenuItem } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { reportCreationAdapter } from '../../../../../reports/reportCreationAdapter';
import { wireframeCreationAdapter } from '../../../../../wireframes/wireframeCreationAdapter';

type Params = {
  readonly sessionId: SessionId;
};

export const useArtifactCreateItems = ({ sessionId }: Params): ReadonlyArray<OverflowMenuItem> => {
  const openArtifactCreation = useAppStore((state) => state.openArtifactCreation);
  return [
    {
      kind: 'item',
      key: 'report',
      label: 'Report',
      description: reportCreationAdapter.ctaTitle,
      icon: CONCEPT_ICONS.changelog,
      tone: 'info',
      onClick: () => openArtifactCreation({ sessionId, kind: 'report', workflowRunId: null }),
    },
    {
      kind: 'item',
      key: 'wireframe',
      label: 'Wireframe',
      description: wireframeCreationAdapter.ctaTitle,
      icon: LayoutTemplate,
      tone: 'primary',
      onClick: () => openArtifactCreation({ sessionId, kind: 'wireframe', workflowRunId: null }),
    },
  ];
};
