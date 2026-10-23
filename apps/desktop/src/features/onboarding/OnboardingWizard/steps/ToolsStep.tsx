import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, FormActions, KeyHint, Notice, cn, useEscapeLayer } from '@goodboy/ui';
import type { Project, WorkspaceId } from '@goodboy/types';
import { GithubFormBody } from '../../../integrations/github/GithubFormBody';
import { FORM_BODIES } from '../../../integrations/formBodies';
import { useToolConnections } from '../../../integrations/useToolConnections';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { hostFromRemote, hostsInOrder, type CodeHost } from '../hostFromRemote';
import { isStepEnter } from '../stepEnter';
import { useProjectRemote } from '../useProjectRemote';
import { wizardCta } from '../wizardCta';
import type { WizardMode } from '../wizardSteps';
import { StepHeading } from './StepHeading';
import { StepListRow } from './StepListRow';
import { ToolRow } from './ToolRow';
import { ToolsSection } from './ToolsSection';

type Tool = CodeHost | 'linear' | 'jira';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly projects: ReadonlyArray<Project>;
  readonly mode: WizardMode;
  readonly isLocked: boolean;
  readonly onBack: (() => void) | null;
  readonly onContinue: () => void;
  readonly onOpenSettings: () => void;
};

type HostLineParams = {
  readonly host: CodeHost;
  readonly isConnected: boolean;
  readonly identity: string | null;
  readonly pushingFolder: string | null;
};

const HOST_LINE: Readonly<Record<CodeHost, string>> = {
  github: 'The GitHub CLI or a token',
  gitlab: 'gitlab.com or your own server, with a token',
  bitbucket: 'Bitbucket Cloud, with an app password',
};

const hostLine = ({ host, isConnected, identity, pushingFolder }: HostLineParams): string => {
  const base =
    host === 'github' && isConnected && identity !== null
      ? `Signed in as ${identity}`
      : HOST_LINE[host];
  return pushingFolder === null ? base : `${base}. ${pushingFolder} pushes here`;
};

const HOST_LABEL: Readonly<Record<CodeHost, string>> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
};

const MANAGER_LINE = {
  linear: 'Issues and projects, with a personal API key',
  jira: 'Jira Cloud, with an API token',
} as const satisfies Readonly<Record<'linear' | 'jira', string>>;

export const ToolsStep = ({
  workspaceId,
  workspaceName,
  projects,
  mode,
  isLocked,
  onBack,
  onContinue,
  onOpenSettings,
}: Props) => {
  const [boundId] = useState(workspaceId);
  const [openTool, setOpenTool] = useState<Tool | null>(null);
  const [isOtherHostsOpen, setIsOtherHostsOpen] = useState(false);
  const { connected, githubIdentity } = useToolConnections({ workspaceId: boundId });
  const firstRepo = projects.filter((project) => project.kind === 'repo')[0] ?? null;
  const originHost = hostFromRemote(useProjectRemote({ project: firstRepo }));
  const [leadHost, ...otherHosts] = hostsInOrder(originHost);
  const issueHost =
    firstRepo === null ? null : connected.github ? 'github' : connected.gitlab ? 'gitlab' : null;
  const cta = wizardCta({
    step: 'tools',
    mode,
    readyCount: 0,
    isIssuePick: false,
    hasFailed: false,
  });
  useEscapeLayer(() => setOpenTool(null), openTool !== null);
  const toggle = (tool: Tool) => setOpenTool(openTool === tool ? null : tool);
  const GitlabBody = FORM_BODIES.gitlab;
  const BitbucketBody = FORM_BODIES.bitbucket;
  const LinearBody = FORM_BODIES.linear;
  const JiraBody = FORM_BODIES.jira;
  const HOST_FORM: Readonly<Record<CodeHost, ReactNode>> = {
    github: <GithubFormBody workspaceId={boundId} shouldAutoFocus />,
    gitlab: <GitlabBody workspaceId={boundId} shouldAutoFocus />,
    bitbucket: <BitbucketBody workspaceId={boundId} shouldAutoFocus />,
  };

  const hostRow = (host: CodeHost) => (
    <ToolRow
      key={host}
      provider={host}
      line={hostLine({
        host,
        isConnected: connected[host],
        identity: githubIdentity,
        pushingFolder: host === originHost ? (firstRepo?.name ?? null) : null,
      })}
      isReady={connected[host]}
      isOpen={openTool === host}
      onToggle={() => toggle(host)}
      form={HOST_FORM[host]}
    />
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isStepEnter(event) || isLocked) {
      return;
    }
    event.preventDefault();
    onContinue();
  };

  return (
    <div className="flex flex-col gap-6" onKeyDown={onKeyDown}>
      <StepHeading
        title="Your tools"
        line="Connect where code and tasks live, so agents can open pull requests and pick up issues. Settings has the same page for later."
      />
      <ToolsSection label="Code">
        {firstRepo === null || leadHost === undefined ? (
          <Notice
            tone="info"
            placement="inline"
            title={`${workspaceName} has no git folders`}
            body="So there is nothing to push. Tasks still work."
          />
        ) : (
          <ul className="flex flex-col rounded-lg bg-fill p-1">
            {hostRow(leadHost)}
            <StepListRow
              rowId="other-hosts"
              isCompact
              isQuiet
              icon={
                <ChevronRight
                  size={ICON_SIZE.row}
                  className={cn(
                    'motion-safe:transition-transform',
                    isOtherHostsOpen && 'rotate-90',
                  )}
                />
              }
              name={
                <span className="flex items-center gap-2">
                  Other code hosts
                  <span className="text-faint-foreground">
                    {otherHosts.map((host) => HOST_LABEL[host]).join(', ')}
                  </span>
                </span>
              }
              line=""
              isExpanded={isOtherHostsOpen}
              onPress={() => setIsOtherHostsOpen((wasOpen) => !wasOpen)}
            />
            {isOtherHostsOpen ? otherHosts.map(hostRow) : null}
          </ul>
        )}
      </ToolsSection>
      <ToolsSection label="Tasks">
        <ul className="flex flex-col rounded-lg bg-fill p-1">
          {issueHost === null ? null : (
            <ToolRow
              provider={issueHost}
              label={`${HOST_LABEL[issueHost]} Issues`}
              line={`Comes with ${HOST_LABEL[issueHost]}`}
              isReady
              isOpen={false}
              onToggle={() => undefined}
            />
          )}
          <ToolRow
            provider="linear"
            line={MANAGER_LINE.linear}
            isReady={connected.linear}
            isOpen={openTool === 'linear'}
            onToggle={() => toggle('linear')}
            form={<LinearBody workspaceId={boundId} shouldAutoFocus />}
          />
          <ToolRow
            provider="jira"
            line={MANAGER_LINE.jira}
            isReady={connected.jira}
            isOpen={openTool === 'jira'}
            onToggle={() => toggle('jira')}
            form={<JiraBody workspaceId={boundId} shouldAutoFocus />}
          />
        </ul>
      </ToolsSection>
      <FormActions
        leading={
          <span className="flex items-center gap-1 text-meta text-faint-foreground">
            More tools in
            <Button size="xs" variant="quiet" onClick={onOpenSettings}>
              Settings, Integrations
            </Button>
          </span>
        }
      >
        {onBack === null ? null : (
          <Button
            size="md"
            variant="ghost"
            className="text-muted-foreground"
            disabled={isLocked}
            onClick={onBack}
          >
            Back
          </Button>
        )}
        <Button
          size="md"
          variant="primary"
          disabled={isLocked}
          onClick={onContinue}
          data-demo-anchor="setup-continue"
        >
          {cta.primary}
          <KeyHint keys={shortcutGlyphs('composer.send')} isOnTone />
        </Button>
      </FormActions>
    </div>
  );
};
