import { useState } from 'react';
import { ArrowLeftRight, Check, ExternalLink, MessageSquare } from 'lucide-react';
import { Button, formatError, Listbox } from '@goodboy/ui';
import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import { openUrl } from '../../../shared/lib/editor';
import { useAppStore } from '../../../store';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { ConnectSteps, type ConnectStepDef } from '../components/ConnectSteps';
import { CheckStatus } from '../components/ConnectSteps/CheckStatus';
import { StepField } from '../components/ConnectSteps/StepField';
import { IntegrationCredentialPicker } from '../components/IntegrationCredentialPicker';
import { WhatGoodboyCanDo } from '../components/WhatGoodboyCanDo';
import { useDebouncedCheck } from '../hooks/useDebouncedCheck';
import { normalizeHostUrl } from '../shared/normalizeHostUrl';
import {
  jiraListProjects,
  jiraValidateConnection,
  type JiraProject,
  type JiraUser,
} from './client';

const TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly shouldAutoFocus?: boolean;
  readonly onConnected?: () => void;
};

type Lookup = {
  readonly user: JiraUser;
  readonly projects: ReadonlyArray<JiraProject>;
};

export const JiraConnectSteps = ({ workspaceId, shouldAutoFocus = false, onConnected }: Props) => {
  const connectJira = useAppStore((state) => state.connectJira);
  const [hasOpenedLink, setHasOpenedLink] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [savedId, setSavedId] = useState<IntegrationCredentialId | null>(null);
  const [draftId] = useState(() => crypto.randomUUID() as IntegrationCredentialId);
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const site = normalizeHostUrl({ input: siteUrl, fallback: '' });
  const trimmedEmail = email.trim();
  const trimmedToken = token.trim();
  const hasSecret = savedId !== null || trimmedToken !== '';
  const isComplete = site !== '' && trimmedEmail !== '' && hasSecret;
  const credentialId = savedId ?? draftId;
  const apiToken = savedId === null ? trimmedToken : null;

  const check = useDebouncedCheck<Lookup>({
    key: isComplete ? JSON.stringify([site, trimmedEmail, savedId, trimmedToken]) : null,
    run: async () => {
      const params = { credentialId, siteUrl: site, email: trimmedEmail, apiToken };
      const user = await jiraValidateConnection(params);
      const projects = await jiraListProjects(params);
      return { user, projects };
    },
  });
  const lookup = check.status === 'ok' ? check.value : null;

  const connect = async (key: string) => {
    setProjectKey(key);
    setIsConnecting(true);
    setConnectError(null);
    try {
      await connectJira({
        workspaceId,
        siteUrl: site,
        email: trimmedEmail,
        projectKey: key,
        apiToken,
        credentialId: savedId,
      });
      onConnected?.();
    } catch (error) {
      setConnectError(formatError(error));
    } finally {
      setIsConnecting(false);
    }
  };

  const step1Done = hasOpenedLink || hasSecret || siteUrl !== '' || email !== '';

  const steps: ReadonlyArray<ConnectStepDef> = [
    {
      id: 'open-atlassian',
      title: 'Create an API token in Atlassian',
      help: 'Choose Create API token, name it Goodboy, then Copy.',
      status: step1Done ? 'done' : 'current',
      content: step1Done ? undefined : (
        <Button
          size="sm"
          onClick={() => {
            setHasOpenedLink(true);
            void openUrl(TOKEN_URL);
          }}
        >
          Open Atlassian
          <ExternalLink size={ICON_SIZE.row} aria-hidden />
        </Button>
      ),
    },
    {
      id: 'paste-token',
      title: 'Paste your site, email and API token',
      help: 'Goodboy checks them as soon as all three are in.',
      status: lookup !== null ? 'done' : step1Done ? 'current' : 'later',
      content: (
        <div className="flex min-w-0 flex-col gap-2">
          <IntegrationCredentialPicker
            provider="jira"
            selectedCredentialId={savedId}
            onSelect={(credential) => {
              setSavedId(credential?.id ?? null);
              if (credential !== null && credential.account !== '') {
                setEmail(credential.account);
              }
            }}
          />
          <StepField
            id="jira-site"
            label="Site"
            placeholder="acme.atlassian.net"
            value={siteUrl}
            onChange={setSiteUrl}
            shouldAutoFocus={shouldAutoFocus}
          />
          <StepField
            id="jira-email"
            label="Email"
            type="email"
            placeholder="you@acme.com"
            value={email}
            onChange={setEmail}
          />
          {savedId === null ? (
            <StepField
              id="jira-token"
              label="API token"
              type="password"
              placeholder="ATATT…"
              value={token}
              onChange={setToken}
            />
          ) : null}
          <CheckStatus
            status={check.status}
            checkingLabel="Checking with Jira"
            okLabel={lookup === null ? null : `Signed in as ${lookup.user.displayName}`}
            error={check.status === 'error' ? check.error : null}
          />
        </div>
      ),
    },
    {
      id: 'pick-project',
      title: 'Pick a project',
      help: 'Goodboy lists its issues as tasks.',
      status: lookup === null ? 'later' : 'current',
      content: (
        <div className="flex min-w-0 flex-col gap-2">
          <Listbox
            ariaLabel="Jira project"
            placeholder={
              lookup !== null && lookup.projects.length === 0 ? 'No projects' : 'Choose a project'
            }
            searchable
            noun="project"
            disabled={lookup === null || isConnecting}
            value={projectKey}
            options={(lookup?.projects ?? []).map((project) => ({
              value: project.key,
              label: project.name,
              meta: project.key,
            }))}
            onChange={(key) => void connect(key)}
          />
          <CheckStatus
            status={isConnecting ? 'checking' : connectError === null ? 'idle' : 'error'}
            checkingLabel="Connecting"
            okLabel={null}
            error={connectError}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ConnectSteps steps={steps} ariaLabel="Connect Jira" />
      <WhatGoodboyCanDo
        title="What Goodboy can do with this"
        lines={[
          { icon: <Check size={ICON_SIZE.row} aria-hidden />, text: 'Reads issues and comments' },
          {
            icon: <ArrowLeftRight size={ICON_SIZE.row} aria-hidden />,
            text: 'Changes status and assignee',
          },
          {
            icon: <MessageSquare size={ICON_SIZE.row} aria-hidden />,
            text: 'Comments as you',
          },
        ]}
        footnote="Jira Cloud only. Data Center and Server are not supported."
      />
    </div>
  );
};
