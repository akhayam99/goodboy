import { Notice, SectionHeader, PaneShell } from '@goodboy/ui';
import type { IntegrationBinding, WorkspaceId } from '@goodboy/types';
import { TOOL_CATALOG } from '../../toolCatalog';
import { SETTINGS_PANE_ENTRY } from '../../../settings/components/SettingsStudio/settingsPaneEntry';
import { ObjectActionVerb } from '../../../actions/ObjectActionVerb';
import { IntegrationMenu } from '../../../actions/IntegrationMenu';
import { integrationLabel, type IntegrationGlyphProvider } from '../IntegrationGlyph';
import { FORM_BODIES } from '../../formBodies';
import { toolHealthOf } from '../../toolHealthOf';
import { useCredentialSecret } from '../../useCredentialSecret';
import { useIntegrationTarget } from '../../useIntegrationTarget';
import { toolIdentity } from './toolIdentity';
import type { GithubConnection } from '../../github/useGithubConnection';
import { GithubAccountRows } from './GithubAccountRows';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly provider: IntegrationGlyphProvider;
  readonly isConnected: boolean;
  readonly binding: IntegrationBinding | undefined;
  readonly github: GithubConnection;
  readonly githubIdentity: string | null;
};

export const ToolDetailPanel = ({
  workspaceId,
  provider,
  isConnected,
  binding,
  github,
  githubIdentity,
}: Props) => {
  const FormBody = provider === 'github' ? null : FORM_BODIES[provider];
  const title = integrationLabel({ provider });
  const target = useIntegrationTarget({ workspaceId, provider, isConnected, github });
  const secret = useCredentialSecret({ credentialId: binding?.credentialId ?? null });
  const health = toolHealthOf({ tool: provider, isConnected, secret });
  const subtitle = isConnected
    ? provider === 'github'
      ? (githubIdentity ?? 'connected')
      : toolIdentity({ binding })
    : TOOL_CATALOG.find((entry) => entry.provider === provider)?.connectLabel;
  return (
    <PaneShell
      scroll="body"
      animationClassName={SETTINGS_PANE_ENTRY}
      title={title}
      meta={subtitle}
      actions={<IntegrationMenu target={target} />}
    >
      {health.signal === 'danger' ? (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={`The ${title} key is missing from this Mac`}
          body={`Every request to ${title} fails. Disconnect, then connect again to paste a new key.`}
          actions={<ObjectActionVerb target={target} actionId="integration.disconnect" />}
        />
      ) : null}
      <section className="flex flex-col gap-2">
        <SectionHeader label="Account" />
        {FormBody === null ? (
          <GithubAccountRows workspaceId={workspaceId} connection={github} />
        ) : (
          <FormBody workspaceId={workspaceId} shouldAutoFocus={!isConnected} hasHeaderDisconnect />
        )}
      </section>
    </PaneShell>
  );
};
