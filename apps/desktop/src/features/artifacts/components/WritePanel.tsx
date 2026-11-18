import { Suspense } from 'react';
import { lazyNamed } from '../../../shared/lib/lazyNamed';
import type { WritePanelProps } from '../writePanelProps';

const ArtifactCreationPane = lazyNamed({
  load: () => import('./ArtifactCreationPane'),
  pick: ({ ArtifactCreationPane }) => ArtifactCreationPane,
});

export const WritePanel = ({
  session,
  kind,
  note,
  actionsHost,
  onStarted,
  onClose,
}: WritePanelProps) => (
  <Suspense key={kind} fallback={null}>
    <ArtifactCreationPane
      sessionId={session.id}
      session={session}
      kind={kind}
      note={note}
      actionsHost={actionsHost}
      onClose={onClose}
      onStarted={onStarted}
    />
  </Suspense>
);
