import type { GhTokenStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { GithubFormBody } from '../../../github/GithubFormBody';
import { IntegrationConnectedRow } from '../../IntegrationConnectedRow';
import { IntegrationGlyph } from '../../IntegrationGlyph';

type Props = {
  readonly status: GhTokenStatus;
};

type PatLabelParams = {
  readonly status: GhTokenStatus;
};

const patLabel = ({ status }: PatLabelParams): string => {
  const scope = (status.scopes ?? []).includes('repo') ? ' (repo scope)' : '';
  return `Connected as ${status.user ?? 'an unknown user'} with a personal API key${scope}`;
};

export const AllWorkspacesRow = ({ status }: Props) => {
  const clearGithubToken = useAppStore((state) => state.clearGithubToken);

  if (status.mode === 'pat') {
    return (
      <IntegrationConnectedRow
        provider="github"
        primary={patLabel({ status })}
        disconnectDescription="Deletes the all-workspaces GitHub key from your keychain. Workspace keys and the gh CLI login stay."
        onDisconnect={async () => {
          await clearGithubToken({ workspaceId: null });
        }}
      />
    );
  }

  if (status.mode === 'gh-cli') {
    return (
      <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border-soft bg-subtle px-3 py-2.5">
        <IntegrationGlyph provider="github" size={ICON_SIZE.control} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-medium text-foreground">
            {`Connected as ${status.user ?? 'an unknown user'} through the gh CLI`}
          </span>
          <span className="truncate text-2xs text-muted-foreground">
            Run gh auth logout to sign out
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Paste a personal API key, or run <code>gh auth login</code> in a terminal and check the
        connection again.
      </p>
      <GithubFormBody workspaceId={null} />
    </div>
  );
};
