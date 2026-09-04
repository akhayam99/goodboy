import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  IntegrationCredential,
  IntegrationCredentialId,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { KeyRound } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { CredentialRow } from './CredentialRow';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly provider: WorkspaceIntegrationProvider;
  readonly selectedCredentialId: IntegrationCredentialId | null;
  readonly onSelect: (credential: IntegrationCredential | null) => void;
  readonly isDisabled?: boolean;
};

export const IntegrationCredentialPicker = ({
  provider,
  selectedCredentialId,
  onSelect,
  isDisabled = false,
}: Props) => {
  const credentials = useAppStore(
    useShallow((state) =>
      state.integrationCredentials.filter((credential) => credential.provider === provider),
    ),
  );
  const usage = useAppStore((state) => state.integrationCredentialUsage);
  const forgetIntegrationCredential = useAppStore((state) => state.forgetIntegrationCredential);
  const [error, setError] = useState<string | null>(null);

  if (credentials.length === 0) {
    return null;
  }

  const forget = async ({ credentialId }: { readonly credentialId: IntegrationCredentialId }) => {
    setError(null);
    try {
      await forgetIntegrationCredential({ credentialId });
      if (selectedCredentialId === credentialId) {
        onSelect(null);
      }
    } catch (forgetError) {
      setError(formatError(forgetError));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-foreground">Saved personal API keys</span>
      <p className="text-2xs leading-relaxed text-muted-foreground">
        A key you entered once is offered to every project. Pick one to link this project without
        typing it again.
      </p>
      {credentials.map((credential) => (
        <CredentialRow
          key={credential.id}
          credential={credential}
          usedBy={usage[credential.id] ?? 0}
          isSelected={selectedCredentialId === credential.id}
          isDisabled={isDisabled}
          onSelect={() => onSelect(credential)}
          onForget={() => void forget({ credentialId: credential.id })}
        />
      ))}
      <button
        type="button"
        onClick={() => onSelect(null)}
        disabled={isDisabled}
        aria-pressed={selectedCredentialId === null}
        className="flex items-center gap-2 rounded-md border border-dashed border-border-soft px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <KeyRound size={ICON_SIZE.row} aria-hidden />
        Use a new personal API key
      </button>
      {error !== null ? <p className="text-2xs leading-relaxed text-danger">{error}</p> : null}
    </div>
  );
};
