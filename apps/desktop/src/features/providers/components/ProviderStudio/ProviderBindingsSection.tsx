import { useMemo } from 'react';
import { Select } from '@goodboy/ui';
import { FolderGit2 } from 'lucide-react';
import { CLI_CREDENTIAL, type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { SectionHeader } from './SectionHeader';

interface Props {
  readonly providerId: ProviderId;
  readonly cliIdentity: string | null;
}

export function ProviderBindingsSection({ providerId, cliIdentity }: Props) {
  const credentials = useAppStore((s) => s.providerCredentials);
  const workspaces = useAppStore((s) => s.workspaces);
  const workspaceOverrides = useAppStore((s) => s.workspaceOverrides);
  const setWorkspaceProviderBinding = useAppStore((s) => s.setWorkspaceProviderBinding);

  const mine = useMemo(
    () => credentials.filter((c) => c.providerId === providerId),
    [credentials, providerId],
  );
  const connected = useMemo(() => workspaces.filter((w) => !w.disconnectedAt), [workspaces]);

  if (mine.length === 0 || connected.length === 0) return null;

  const cliLabel = cliIdentity ? `CLI login (${cliIdentity})` : 'CLI login';

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader
        label="Workspace credentials"
        hint={`Pick which credential each workspace uses for ${providerId}.`}
      />
      <ul className="flex flex-col gap-2">
        {connected.map((ws) => {
          const bound = workspaceOverrides[ws.id]?.providerBindings?.[providerId] ?? CLI_CREDENTIAL;
          const usingKey = bound !== CLI_CREDENTIAL;
          return (
            <li
              key={ws.id}
              className="flex items-center gap-3 rounded-lg border border-border-soft bg-muted/20 p-3"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                aria-hidden
              >
                <FolderGit2 size={14} />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{ws.name}</span>
                <span className="text-2xs text-muted-foreground/70">
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
                <option value={CLI_CREDENTIAL}>{cliLabel}</option>
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
    </section>
  );
}
