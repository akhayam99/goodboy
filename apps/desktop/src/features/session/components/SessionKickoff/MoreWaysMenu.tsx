import { ChevronDown, LayoutTemplate } from 'lucide-react';
import { OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { hasArtifactEvidence } from '../../../artifacts/artifactCtaState';
import { reportCreationAdapter } from '../../../reports/reportCreationAdapter';

type Props = {
  readonly sessionId: SessionId;
};

const LABEL = 'More ways to start';

export const MoreWaysMenu = ({ sessionId }: Props) => {
  const openArtifactCreation = useAppStore((state) => state.openArtifactCreation);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);

  const wireframe: OverflowMenuItem = {
    kind: 'item',
    key: 'wireframe',
    label: 'Draw a wireframe',
    description: 'Sketch the screen or flow you describe.',
    icon: LayoutTemplate,
    tone: 'primary',
    onClick: () => openArtifactCreation({ sessionId, kind: 'wireframe', workflowRunId: null }),
  };
  const report: OverflowMenuItem = {
    kind: 'item',
    key: 'report',
    label: 'Write a report',
    description: reportCreationAdapter.ctaTitle,
    icon: CONCEPT_ICONS.changelog,
    tone: 'info',
    onClick: () => openArtifactCreation({ sessionId, kind: 'report', workflowRunId: null }),
  };
  const items = hasArtifactEvidence({ agents }) ? [wireframe, report] : [wireframe];

  return (
    <OverflowMenu
      items={items}
      label={LABEL}
      triggerClassName="flex items-center gap-1 px-1.5 text-secondary"
      trigger={
        <>
          <span>{LABEL}</span>
          <ChevronDown size={ICON_SIZE.row} aria-hidden />
        </>
      }
    />
  );
};
