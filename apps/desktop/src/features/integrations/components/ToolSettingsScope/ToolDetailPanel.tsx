import { Button, SectionHeader } from '@goodboy/ui';
import type { IntegrationBinding, WorkspaceId } from '@goodboy/types';
import { FOOTER_INTEGRATIONS } from '../../../../app/components/AppFooter/categories';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { SETTINGS_PANE_ENTRY } from '../../../settings/components/SettingsStudio/settingsPaneEntry';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../IntegrationGlyph';
import { FORM_BODIES } from '../../formBodies';
import { toolIdentity } from './toolIdentity';
import type { GithubConnection } from '../../github/useGithubConnection';
import { GithubAccountRows } from './GithubAccountRows';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

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
  const subtitle = isConnected
    ? provider === 'github'
      ? (githubIdentity ?? 'connected')
      : toolIdentity({ binding })
    : FOOTER_INTEGRATIONS.find((entry) => entry.provider === provider)?.connectLabel;
  return (
    <PaneShell
      scroll="body"
      animationClassName={SETTINGS_PANE_ENTRY}
      title={title}
      meta={subtitle}
      glyph={<IntegrationGlyph provider={provider} size={ICON_SIZE.hero} />}
    >
      <section className="flex flex-col gap-2">
        <SectionHeader label="Account" />
        {FormBody === null ? (
          <GithubAccountRows workspaceId={workspaceId} connection={github} />
        ) : (
          <FormBody workspaceId={workspaceId} shouldAutoFocus={!isConnected} />
        )}
      </section>
      {isConnected ? (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              window.dispatchEvent(new CustomEvent('goodboy:open-inbox', { detail: { provider } }))
            }
          >
            Open in inbox
          </Button>
        </div>
      ) : null}
    </PaneShell>
  );
};
