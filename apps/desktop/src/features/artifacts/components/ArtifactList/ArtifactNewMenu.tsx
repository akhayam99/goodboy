import { ChevronDown, Plus } from 'lucide-react';
import { AnchoredPopover, Button, MenuItems, useDropdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ARTIFACT_KIND_CONCEPT } from '../../artifactPresentation';

type Props = {
  readonly sessionId: SessionId;
};

export const ArtifactNewMenu = ({ sessionId }: Props) => {
  const openArtifactCreation = useAppStore((state) => state.openArtifactCreation);
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-72 max-w-[calc(100vw-2rem)]',
    expectedHeight: 120,
    expectedWidth: 288,
  });

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="New artifact"
      className="py-1"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          onClick={dropdown.toggle}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          data-testid="artifact-new"
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
          New
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
        </Button>
      }
    >
      <MenuItems
        onClose={dropdown.close}
        items={[
          {
            kind: 'item',
            key: 'report',
            label: 'Report',
            description: 'Writes up what this session did, from its agents and changes',
            icon: CONCEPT_ICONS[ARTIFACT_KIND_CONCEPT.report],
            onClick: () => openArtifactCreation({ sessionId, kind: 'report', workflowRunId: null }),
          },
          {
            kind: 'item',
            key: 'wireframe',
            label: 'Wireframe',
            description: 'Draws the screens and the flow you describe',
            icon: CONCEPT_ICONS[ARTIFACT_KIND_CONCEPT.wireframe],
            onClick: () =>
              openArtifactCreation({ sessionId, kind: 'wireframe', workflowRunId: null }),
          },
        ]}
      />
    </AnchoredPopover>
  );
};
