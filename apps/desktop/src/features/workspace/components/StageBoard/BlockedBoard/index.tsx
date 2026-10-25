import { useState } from 'react';
import { Button, EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { openSettings } from '../../../../settings/openSettings';
import type { ProjectGitStatusEntry } from '../../../hooks/useProjectGitStatuses';
import { TrackWithGitFlow } from '../../TrackWithGitFlow';

type Props = {
  readonly entries: ReadonlyArray<ProjectGitStatusEntry>;
  readonly title: string;
  readonly description: string;
};

export const BlockedBoard = ({ entries, title, description }: Props) => {
  const [isCommitting, setIsCommitting] = useState(false);
  const unborn = entries.find((entry) => entry.status?.state === 'unborn')?.project ?? null;
  return (
    <div data-slot="board-empty" className="flex min-w-0 flex-col gap-4">
      <EmptyState
        icon={CONCEPT_ICONS.projectRepo}
        title={title}
        description={description}
        action={
          unborn === null ? (
            <Button
              size="md"
              variant="secondary"
              onClick={() => openSettings({ scope: 'workspace' })}
            >
              Open workspace settings
            </Button>
          ) : isCommitting ? null : (
            <Button size="md" onClick={() => setIsCommitting(true)}>
              Make the first commit
            </Button>
          )
        }
        size="page"
        headingLevel={2}
      />
      {unborn !== null && isCommitting ? (
        <TrackWithGitFlow
          project={unborn}
          heading={`First commit in ${unborn.name}`}
          onCancel={() => setIsCommitting(false)}
          onTracked={() => setIsCommitting(false)}
        />
      ) : null}
    </div>
  );
};
