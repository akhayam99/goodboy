import { useState } from 'react';
import { FolderGit2, ListChecks } from 'lucide-react';
import { Button, JiraIcon, LinearIcon, SlackIcon } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { JiraFormBody } from '../../../integrations/jira/JiraFormBody';
import { LinearFormBody } from '../../../integrations/linear/LinearFormBody';
import { SlackFormBody } from '../../../integrations/slack/SlackFormBody';
import { Segmented, type SegmentedOption } from '../Segmented';

type Tool = 'linear' | 'jira' | 'slack';

type Props = {
  readonly workspaceId: WorkspaceId | null;
  readonly linearConnected: boolean;
  readonly jiraConnected: boolean;
  readonly slackConnected: boolean;
};

export const TrackerStep = ({
  workspaceId,
  linearConnected,
  jiraConnected,
  slackConnected,
}: Props) => {
  const [tool, setTool] = useState<Tool>('linear');

  const options: ReadonlyArray<SegmentedOption<Tool>> = [
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
    {
      value: 'slack',
      label: 'Slack',
      icon: SlackIcon,
      color: 'var(--color-provider-slack)',
      connected: slackConnected,
    },
  ];

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-foreground">
        <ListChecks size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect your tools
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Link a tracker to pull issue context, or connect Slack, a conversation tool, so agents can
          post where you already work.
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
          <Segmented ariaLabel="Tools" options={options} value={tool} onChange={setTool} />
          <div className="rounded-lg border border-border-soft/40 bg-subtle/20 p-4">
            {tool === 'linear' ? (
              <LinearFormBody workspaceId={workspaceId} />
            ) : tool === 'jira' ? (
              <JiraFormBody workspaceId={workspaceId} />
            ) : (
              <SlackFormBody workspaceId={workspaceId} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
