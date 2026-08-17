import { useState } from 'react';
import { FolderGit2, ListChecks } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { JiraIcon, LinearIcon } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { JiraFormBody } from '../../../integrations/jira/JiraFormBody';
import { LinearFormBody } from '../../../integrations/linear/LinearFormBody';
import { Segmented, type SegmentedOption } from '../Segmented';

type Tracker = 'linear' | 'jira';

type Props = {
  readonly workspaceId: WorkspaceId | null;
  readonly linearConnected: boolean;
  readonly jiraConnected: boolean;
};

export const TrackerStep = ({ workspaceId, linearConnected, jiraConnected }: Props) => {
  const [tracker, setTracker] = useState<Tracker>('linear');

  const options: ReadonlyArray<SegmentedOption<Tracker>> = [
    {
      value: 'linear',
      label: 'Linear',
      icon: LinearIcon,
      color: 'var(--color-provider-linear)',
      connected: linearConnected,
    },
    {
      value: 'jira',
      label: 'Jira',
      icon: JiraIcon,
      color: 'var(--color-provider-jira)',
      connected: jiraConnected,
    },
  ];

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span
        className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40"
        style={{ color: 'var(--color-provider-linear)' }}
      >
        <ListChecks size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect your issue tracker
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Link Linear or Jira so agents can pull issue context and ship against real tickets.
        </p>
      </div>

      {workspaceId === null ? (
        <EmptyState
          bordered
          icon={CONCEPT_ICONS.workspace}
          tone={CONCEPT_TONE.workspace}
          title="Add a workspace first to connect your tracker."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('goodboy:add-workspace'))}
            >
              <FolderGit2 size={14} aria-hidden /> Add workspace
            </Button>
          }
        />
      ) : (
        <div className="flex w-full flex-col gap-4 text-left">
          <Segmented
            ariaLabel="Issue tracker"
            options={options}
            value={tracker}
            onChange={setTracker}
          />
          <div className="rounded-lg border border-border-soft/40 bg-subtle/20 p-4">
            {tracker === 'jira' ? (
              <JiraFormBody workspaceId={workspaceId} />
            ) : (
              <LinearFormBody workspaceId={workspaceId} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
