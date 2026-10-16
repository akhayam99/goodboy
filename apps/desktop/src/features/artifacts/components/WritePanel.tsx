import type { WritePanelProps } from '../writePanelProps';
import { ArtifactCreationPane } from './ArtifactCreationPane';

export const WritePanel = ({
  session,
  kind,
  note,
  actionsHost,
  onStarted,
  onClose,
}: WritePanelProps) => (
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
);
