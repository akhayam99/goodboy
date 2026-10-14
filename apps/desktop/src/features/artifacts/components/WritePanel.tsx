import { LayoutTemplate } from 'lucide-react';
import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { WritePanelProps } from '../writePanelProps';
import type { GeneratedArtifactKind } from '../artifactCollection';
import { ArtifactCreationPane } from './ArtifactCreationPane';

const FORMAT_OPTIONS: ReadonlyArray<SegmentedTabOption<GeneratedArtifactKind>> = [
  { value: 'report', label: 'Report', icon: CONCEPT_ICONS.changelog },
  { value: 'wireframe', label: 'Wireframe', icon: LayoutTemplate },
];

export const WritePanel = ({
  session,
  kind,
  note,
  actionsHost,
  onKind,
  onStarted,
  onClose,
}: WritePanelProps) => (
  <div className="flex min-w-0 flex-col gap-4">
    <SegmentedTabs
      ariaLabel="Write format"
      size="sm"
      value={kind}
      options={FORMAT_OPTIONS}
      onChange={onKind}
    />
    <ArtifactCreationPane
      key={kind}
      sessionId={session.id}
      session={session}
      kind={kind}
      note={note}
      actionsHost={actionsHost}
      onClose={onClose}
      onStarted={onStarted}
    />
  </div>
);
