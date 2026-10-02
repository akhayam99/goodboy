import { useState } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectFirstLapProject } from '../../../store/slices/bootstrap/firstLap';
import { PublishPanel } from '../PublishPanel';
import { useBootstrapWatch } from '../hooks/useBootstrapWatch';

type Props = {
  readonly sessionId: SessionId;
};

export const FirstLapBanner = ({ sessionId }: Props) => {
  const project = useAppStore((state) => selectFirstLapProject({ state, sessionId }));
  const probe = useAppStore((state) =>
    project === null ? null : (state.bootstrapRemoteProbe[project.id]?.probe ?? null),
  );
  const [isPublishing, setIsPublishing] = useState(false);
  useBootstrapWatch({ projectId: project?.id ?? null, enabled: project !== null });

  if (project === null) {
    return null;
  }
  const isOnRemote = probe?.kind === 'main-present';
  const hasRemote = project.remoteUrl !== undefined && project.remoteUrl !== '';

  return (
    <div className="flex flex-col gap-3 bg-subtle px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-label text-foreground">{project.name} · project folder · main</span>
          <span className="text-secondary text-muted-foreground">
            {isOnRemote
              ? 'main is on the remote now.'
              : 'This session works in your project folder. Nothing is published yet.'}
          </span>
        </div>
        {isOnRemote || isPublishing ? null : (
          <Button size="sm" onClick={() => setIsPublishing(true)}>
            Publish
          </Button>
        )}
      </div>
      {probe?.kind === 'unreachable' && hasRemote ? (
        <p role="status" className="text-secondary text-warning">
          Couldn&apos;t check the remote
        </p>
      ) : null}
      {isOnRemote ? (
        <Notice
          tone="info"
          placement="inline"
          title="main is on the remote now"
          body="Your work in the project folder can move into a session called bootstrap."
        />
      ) : null}
      {isPublishing && !isOnRemote ? (
        <PublishPanel
          project={project}
          onPublished={() => setIsPublishing(false)}
          onCancel={() => setIsPublishing(false)}
        />
      ) : null}
    </div>
  );
};
