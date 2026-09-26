import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { FORM_BODIES } from '../../../integrations/formBodies';
import type { CodeHost } from '../hostFromRemote';
import { IntegrationChoiceRow } from './IntegrationChoiceRow';
import { IssueHostRow, type IssueHost } from './IssueHostRow';
import { StepHeading } from './StepHeading';

type TaskManager = 'linear' | 'jira';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly issueHost: IssueHost | null;
  readonly preferredHost: CodeHost | null;
  readonly connected: Readonly<Record<TaskManager, boolean>>;
  readonly onBackToCodeHost: (() => void) | null;
};

const MANAGER_LINE: Readonly<Record<TaskManager, string>> = {
  linear: 'A Linear account. Your admin may need to allow API keys.',
  jira: 'A Jira Cloud site. Any member can create a token.',
};

const MANAGERS: ReadonlyArray<TaskManager> = ['linear', 'jira'];

export const TasksStep = ({
  workspaceId,
  issueHost,
  preferredHost,
  connected,
  onBackToCodeHost,
}: Props) => {
  const [expanded, setExpanded] = useState<TaskManager | null>(null);
  const LinearBody = FORM_BODIES.linear;
  const JiraBody = FORM_BODIES.jira;

  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        title="Where do you track work?"
        line="Pick an issue and an agent starts from it. Skip it if you don't use a tracker."
      />
      <ul className="flex flex-col gap-2">
        <IssueHostRow
          issueHost={issueHost}
          preferredHost={preferredHost}
          onBackToCodeHost={onBackToCodeHost}
        />
        {MANAGERS.map((manager) => (
          <IntegrationChoiceRow
            key={manager}
            provider={manager}
            line={MANAGER_LINE[manager]}
            isReady={connected[manager]}
            isExpanded={expanded === manager}
            onExpandedChange={(next) => setExpanded(next ? manager : null)}
          >
            {manager === 'linear' ? (
              <LinearBody workspaceId={workspaceId} shouldAutoFocus />
            ) : (
              <JiraBody workspaceId={workspaceId} shouldAutoFocus />
            )}
          </IntegrationChoiceRow>
        ))}
      </ul>
      <p className="text-secondary text-faint-foreground">
        Sentry, Slack and the rest live in Settings › Integrations, and in the setup checklist.
      </p>
    </div>
  );
};
