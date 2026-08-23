import { useState, type ReactNode } from 'react';
import type {
  IntegrationCredential,
  IntegrationCredentialId,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';
import { Button, Collapsible, formatError, Input } from '@goodboy/ui';
import { ExternalLink } from 'lucide-react';
import { IntegrationCredentialPicker } from '../IntegrationCredentialPicker';

type ConnectConfigField = {
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly type?: 'text' | 'email';
  readonly hint?: string;
  readonly autoCapitalize?: 'off' | 'characters';
};

export type ConnectSubmission = {
  readonly token: string;
  readonly credentialId: IntegrationCredentialId | null;
};

type ConnectConfig = {
  readonly fields: ReadonlyArray<ConnectConfigField>;
  readonly presentation: 'after-token' | 'disclosure';
  readonly disclosureLabel?: string;
};

type ConnectNote = {
  readonly label: string;
  readonly body: ReactNode;
};

type TokenLink = {
  readonly label: string;
  readonly href: string;
};

type Props = {
  readonly tokenId: string;
  readonly tokenLabel: string;
  readonly tokenPlaceholder: string;
  readonly tokenLink?: TokenLink;
  readonly credentialProvider?: WorkspaceIntegrationProvider;
  readonly config?: ConnectConfig;
  readonly isConfigComplete?: boolean;
  readonly note?: ConnectNote;
  readonly guide?: ReactNode;
  readonly shouldAutoFocus?: boolean;
  readonly onCredentialSelect?: (credential: IntegrationCredential | null) => void;
  readonly onSubmit: (submission: ConnectSubmission) => Promise<void>;
};

const ConfigFieldInput = ({
  field,
  isDisabled,
}: {
  readonly field: ConnectConfigField;
  readonly isDisabled: boolean;
}) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <label htmlFor={field.id} className="text-xs font-medium text-foreground">
      {field.label}
    </label>
    <Input
      id={field.id}
      type={field.type ?? 'text'}
      placeholder={field.placeholder}
      value={field.value}
      onChange={(event) => field.onValueChange(event.target.value)}
      disabled={isDisabled}
      autoCapitalize={field.autoCapitalize ?? 'off'}
      autoCorrect="off"
      spellCheck={false}
    />
    {field.hint != null ? (
      <p className="text-2xs leading-relaxed text-muted-foreground">{field.hint}</p>
    ) : null}
  </div>
);

export const ConnectForm = ({
  tokenId,
  tokenLabel,
  tokenPlaceholder,
  tokenLink,
  credentialProvider,
  config,
  isConfigComplete = true,
  note,
  guide,
  shouldAutoFocus = false,
  onCredentialSelect,
  onSubmit,
}: Props) => {
  const [token, setToken] = useState('');
  const [credentialId, setCredentialId] = useState<IntegrationCredentialId | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  const hasSecret = credentialId !== null || token.trim() !== '';
  const canConnect = hasSecret && isConfigComplete;

  const submit = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await onSubmit({ token: token.trim(), credentialId });
      setToken('');
    } catch (submitError) {
      setError(formatError(submitError));
    } finally {
      setIsBusy(false);
    }
  };

  const configFields =
    config == null ? null : (
      <div className="flex min-w-0 flex-col gap-3">
        {config.fields.map((field) => (
          <ConfigFieldInput key={field.id} field={field} isDisabled={isBusy} />
        ))}
      </div>
    );

  return (
    <form
      className="flex w-full min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (isBusy || !canConnect) {
          return;
        }
        void submit();
      }}
    >
      {credentialProvider != null ? (
        <IntegrationCredentialPicker
          provider={credentialProvider}
          selectedCredentialId={credentialId}
          onSelect={(credential) => {
            setCredentialId(credential?.id ?? null);
            onCredentialSelect?.(credential);
          }}
          isDisabled={isBusy}
        />
      ) : null}
      {credentialId === null ? guide : null}
      {credentialId === null ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={tokenId} className="text-xs font-medium text-foreground">
            {tokenLabel}
          </label>
          <Input
            id={tokenId}
            type="password"
            autoFocus={shouldAutoFocus}
            placeholder={tokenPlaceholder}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            disabled={isBusy}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {tokenLink != null ? (
            <a
              href={tokenLink.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
            >
              {tokenLink.label} <ExternalLink size={10} aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}
      {config != null && config.presentation === 'after-token' && hasSecret ? configFields : null}
      {config != null && config.presentation === 'disclosure' ? (
        <Collapsible
          open={isConfigOpen}
          onOpenChange={setIsConfigOpen}
          trigger={
            <span className="text-2xs font-normal text-muted-foreground">
              {config.disclosureLabel ?? 'Advanced'}
            </span>
          }
        >
          {configFields}
        </Collapsible>
      ) : null}
      {error != null ? (
        <p role="alert" className="text-2xs leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
      {note != null ? (
        <Collapsible
          open={isNoteOpen}
          onOpenChange={setIsNoteOpen}
          trigger={<span className="text-2xs font-normal text-muted-foreground">{note.label}</span>}
        >
          <div className="text-2xs leading-relaxed text-muted-foreground">{note.body}</div>
        </Collapsible>
      ) : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isBusy || !canConnect}
          className={isBusy ? 'animate-border-pulse' : undefined}
        >
          {isBusy ? 'Verifying…' : 'Connect'}
        </Button>
      </div>
    </form>
  );
};
