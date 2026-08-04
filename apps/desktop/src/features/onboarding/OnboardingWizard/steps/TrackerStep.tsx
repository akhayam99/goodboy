import { useState } from 'react';
import { FolderGit2, Kanban, ListChecks } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { LinearIcon } from '../../../../shared/components/brand-icons';
import { LinearFormBody } from '../../../integrations/linear/LinearFormBody';
import { Segmented, type SegmentedOption } from '../Segmented';

type Tracker = 'linear' | 'jira';

type Props = {
  readonly workspaceId: WorkspaceId | null;
  readonly linearConnected: boolean;
};

export const TrackerStep = ({ workspaceId, linearConnected }: Props) => {
  const [tracker, setTracker] = useState<Tracker>('linear');

  const options: ReadonlyArray<SegmentedOption<Tracker>> = [
    {
      value: 'linear',
      label: 'Linear',
      icon: LinearIcon,
      color: 'var(--color-provider-linear)',
      connected: linearConnected,
    },
    { value: 'jira', label: 'Jira', icon: Kanban, badge: 'soon', disabled: true },
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
          Link Linear so agents can pull issue context and ship against real tickets. Jira support
          is on the way.
        </p>
      </div>

      {workspaceId === null ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-border-soft/40 bg-subtle/20 px-4 py-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-muted-foreground">
            <FolderGit2 size={18} aria-hidden />
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Add a workspace first to connect your tracker.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('goodboy:add-workspace'))}
          >
            <FolderGit2 size={14} aria-hidden /> Add workspace
          </Button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4 text-left">
          <Segmented
            ariaLabel="Issue tracker"
            options={options}
            value={tracker}
            onChange={setTracker}
          />
          <div className="rounded-lg border border-border-soft/40 bg-subtle/20 p-4">
            <LinearFormBody workspaceId={workspaceId} />
          </div>
        </div>
      )}
    </div>
  );
};
