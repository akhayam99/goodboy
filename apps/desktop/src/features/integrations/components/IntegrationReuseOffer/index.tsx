import { useState } from 'react';
import type { WorkspaceId, WorkspaceIntegrationProvider } from '@goodboy/types';
import { Button, cn, formatError, tintClasses } from '@goodboy/ui';
import { KeyRound } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { describeIntegrationConfig } from '../../describeIntegrationConfig';
import { resolveReusableIntegration } from '../../resolveReusableIntegration';
import { integrationLabel } from '../IntegrationGlyph';

type Props = {
  readonly provider: WorkspaceIntegrationProvider;
  readonly workspaceId: WorkspaceId;
  readonly onReused?: () => void;
};

const CREDENTIAL_NOUN: Record<WorkspaceIntegrationProvider, string> = {
  linear: 'personal API key',
  sentry: 'personal API key',
  gitlab: 'personal API key',
  jira: 'personal API key',
  bitbucket: 'personal API key',
  slack: 'bot token',
};

export const IntegrationReuseOffer = ({ provider, workspaceId, onReused }: Props) => {
  const source = useAppStore((state) =>
    resolveReusableIntegration({
      provider,
      workspaceId,
      workspaceIntegrations: state.workspaceIntegrations,
    }),
  );
  const sourceWorkspaceId = source?.workspaceId ?? null;
  const sourceWorkspaceName = useAppStore(
    (state) => state.workspaces.find((workspace) => workspace.id === sourceWorkspaceId)?.name ?? '',
  );
  const isDeclined = useAppStore((state) =>
    (state.declinedIntegrationReuse[workspaceId] ?? []).includes(provider),
  );
  const reuseIntegration = useAppStore((state) => state.reuseIntegration);
  const declineIntegrationReuse = useAppStore((state) => state.declineIntegrationReuse);

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (source === null || isDeclined) {
    return null;
  }

  const tint = tintClasses('info');
  const label = integrationLabel({ provider });
  const noun = CREDENTIAL_NOUN[provider];
  const description = describeIntegrationConfig({ integration: source });
  const origin =
    sourceWorkspaceName === ''
      ? description
      : `${description}, configured in ${sourceWorkspaceName}`;

  const onReuse = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await reuseIntegration({ provider, workspaceId });
      onReused?.();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border p-4', tint.borderSoft, tint.bgSoft)}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <KeyRound size={14} aria-hidden className={tint.icon} />
          Reuse the {label} {noun} you already saved?
        </div>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          {origin}. Reusing copies that {noun} into this workspace and applies the same settings.
          Nothing is copied until you say so.
        </p>
      </div>

      {error === null ? null : (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => void onReuse()}
          disabled={isBusy}
          className={isBusy ? 'animate-border-pulse' : undefined}
        >
          {isBusy ? 'Reusing…' : 'Reuse it here'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => declineIntegrationReuse({ provider, workspaceId })}
          disabled={isBusy}
        >
          Enter a different one
        </Button>
      </div>
    </div>
  );
};
