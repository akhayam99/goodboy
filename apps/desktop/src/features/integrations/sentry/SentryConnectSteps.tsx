import { useState } from 'react';
import { Check, ExternalLink, Eye } from 'lucide-react';
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
import { sentryListOrganizations, sentryListProjects } from './client';

const TOKEN_URL = 'https://sentry.io/settings/account/api/auth-tokens/';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly shouldAutoFocus?: boolean;
  readonly onConnected?: () => void;
};

export const SentryConnectSteps = ({
  workspaceId,
  shouldAutoFocus = false,
  onConnected,
}: Props) => {
  const connectSentry = useAppStore((state) => state.connectSentry);
  const [hasOpenedLink, setHasOpenedLink] = useState(false);
  const [token, setToken] = useState('');
  const [savedId, setSavedId] = useState<IntegrationCredentialId | null>(null);
  const [draftId] = useState(() => crypto.randomUUID() as IntegrationCredentialId);
  const [org, setOrg] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const trimmedToken = token.trim();
  const hasSecret = savedId !== null || trimmedToken !== '';
  const credentialId = savedId ?? draftId;
  const secret = savedId === null ? trimmedToken : null;

  const orgs = useDebouncedCheck({
    key: hasSecret ? JSON.stringify([savedId, trimmedToken]) : null,
    run: () => sentryListOrganizations({ credentialId, token: secret }),
  });
  const orgList = orgs.status === 'ok' ? orgs.value : null;
  const projects = useDebouncedCheck({
    key: orgList !== null && org !== null ? JSON.stringify([savedId, trimmedToken, org]) : null,
    run: () => sentryListProjects({ credentialId, token: secret, org: org ?? '' }),
    delayMs: 0,
  });
  const projectList = projects.status === 'ok' ? projects.value : null;

  const connect = async (slug: string) => {
    if (org === null) {
      return;
    }
    setProject(slug);
    setIsConnecting(true);
    setConnectError(null);
    try {
      await connectSentry({
        workspaceId,
        token: secret,
        org,
        project: slug,
        credentialId: savedId,
      });
      onConnected?.();
    } catch (error) {
      setConnectError(formatError(error));
    } finally {
      setIsConnecting(false);
    }
  };

  const step1Done = hasOpenedLink || hasSecret;
  const orgCount = orgList?.length ?? 0;

  const steps: ReadonlyArray<ConnectStepDef> = [
    {
      id: 'open-sentry',
      title: 'Create an auth token in Sentry',
      help: 'Choose Create New Token with Issue & Event: Read, Project: Read and Organization: Read.',
      status: step1Done ? 'done' : 'current',
      content: step1Done ? undefined : (
        <Button
          size="sm"
          onClick={() => {
            setHasOpenedLink(true);
            void openUrl(TOKEN_URL);
          }}
        >
          Open Sentry
          <ExternalLink size={ICON_SIZE.row} aria-hidden />
        </Button>
      ),
    },
    {
      id: 'paste-token',
      title: 'Paste your auth token',
      status: orgList !== null ? 'done' : step1Done ? 'current' : 'later',
      content: (
        <div className="flex min-w-0 flex-col gap-2">
          <IntegrationCredentialPicker
            provider="sentry"
            selectedCredentialId={savedId}
            onSelect={(credential) => setSavedId(credential?.id ?? null)}
          />
          {savedId === null ? (
            <StepField
              id="sentry-token"
              label="Auth token"
              type="password"
              placeholder="sntryu_…"
              value={token}
              onChange={setToken}
              shouldAutoFocus={shouldAutoFocus}
            />
          ) : null}
          <CheckStatus
            status={orgs.status}
            checkingLabel="Checking with Sentry"
            okLabel={
              orgList === null
                ? null
                : `The token works. ${orgCount} ${orgCount === 1 ? 'organization' : 'organizations'} found.`
            }
            error={orgs.status === 'error' ? orgs.error : null}
          />
        </div>
      ),
    },
    {
      id: 'pick-project',
      title: 'Pick the organization and project',
      help: "Goodboy lists the project's unresolved issues.",
      status: orgList === null ? 'later' : 'current',
      content: (
        <div className="flex min-w-0 flex-col gap-2">
          <Listbox
            ariaLabel="Sentry organization"
            placeholder="Choose an organization"
            searchable
            noun="organization"
            disabled={orgList === null || isConnecting}
            value={org}
            options={(orgList ?? []).map((item) => ({ value: item.slug, label: item.name }))}
            onChange={(slug) => {
              setOrg(slug);
              setProject(null);
            }}
          />
          <Listbox
            ariaLabel="Sentry project"
            placeholder="Choose a project"
            searchable
            noun="project"
            disabled={projectList === null || isConnecting}
            value={project}
            options={(projectList ?? []).map((item) => ({
              value: item.slug,
              label: item.name,
              ...(item.platform === null ? {} : { meta: item.platform }),
            }))}
            onChange={(slug) => void connect(slug)}
          />
          <CheckStatus
            status={
              isConnecting || projects.status === 'checking'
                ? 'checking'
                : connectError !== null || projects.status === 'error'
                  ? 'error'
                  : 'idle'
            }
            checkingLabel={isConnecting ? 'Connecting' : 'Loading projects'}
            okLabel={null}
            error={connectError ?? (projects.status === 'error' ? projects.error : null)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ConnectSteps steps={steps} ariaLabel="Connect Sentry" />
      <WhatGoodboyCanDo
        title="What Goodboy can do with this"
        lines={[
          {
            icon: <Check size={ICON_SIZE.row} aria-hidden />,
            text: 'Reads issues and their events',
          },
          {
            icon: <Eye size={ICON_SIZE.row} aria-hidden />,
            text: 'Read only, it never changes Sentry',
          },
        ]}
      />
    </div>
  );
};
