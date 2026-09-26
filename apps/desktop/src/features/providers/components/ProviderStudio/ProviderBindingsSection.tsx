import { CLI_CREDENTIAL, isApiProvider } from '@goodboy/core';
import { useMemo } from 'react';
import { BAND_ROW_CLASS, Band, Select, cn } from '@goodboy/ui';
import { FolderGit2 } from 'lucide-react';
import { type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly providerId: ProviderId;
  readonly cliIdentity: string | null;
};

export const ProviderBindingsSection = ({ providerId, cliIdentity }: Props) => {
  const credentials = useAppStore((s) => s.providerCredentials);
  const workspaces = useAppStore((s) => s.workspaces);
  const workspaceOverrides = useAppStore((s) => s.workspaceOverrides);
  const setWorkspaceProviderBinding = useAppStore((s) => s.setWorkspaceProviderBinding);

  const mine = useMemo(
    () => credentials.filter((c) => c.providerId === providerId),
    [credentials, providerId],
  );
  const connected = useMemo(() => workspaces.filter((w) => !w.disconnectedAt), [workspaces]);
  const isApi = isApiProvider({ id: providerId });

  if (mine.length === 0 || connected.length === 0) {
    return null;
  }

  const cliLabel = cliIdentity ? `CLI login (${cliIdentity})` : 'CLI login';

  return (
    <Band
      label="Workspace credentials"
      hint={`Pick which credential each workspace uses for ${providerId}.`}
    >
      <ul className="flex flex-col">
        {connected.map((ws) => {
          const fallback = isApi ? (mine[0]?.id ?? '') : CLI_CREDENTIAL;
          const bound = workspaceOverrides[ws.id]?.providerBindings?.[providerId] ?? fallback;
          const usingKey = bound !== CLI_CREDENTIAL;
          return (
            <li key={ws.id} className={cn(BAND_ROW_CLASS, 'gap-3')}>
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                aria-hidden
              >
                <FolderGit2 size={ICON_SIZE.control} />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-row text-foreground">{ws.name}</span>
                <span className="text-secondary text-faint-foreground">
                  {usingKey ? 'billed to API key' : 'billed to CLI login'}
                </span>
              </div>
              <div className="flex-1" />
              <Select
                size="sm"
                value={bound}
                onChange={(e) => {
                  const next = e.target.value;
                  void setWorkspaceProviderBinding(
                    ws.id,
                    providerId,
                    next === CLI_CREDENTIAL ? null : next,
                  );
                }}
              >
                {!isApi ? <option value={CLI_CREDENTIAL}>{cliLabel}</option> : null}
                {mine.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </li>
          );
        })}
      </ul>
    </Band>
  );
};
