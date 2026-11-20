import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { PROVIDER_API_KEY_ENV } from '@goodboy/core/providers';
import { useCallback, useMemo, useState } from 'react';
import {
  Button,
  ConfirmPopover,
  EmptyState,
  formatError,
  FormActions,
  ICON_SIZE,
  IconButton,
  Input,
  SectionHeader,
} from '@goodboy/ui';
import { KeyRound, Plus, Trash2 } from '@goodboy/ui/icons';
import { type CredentialId, type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly providerId: ProviderId;
};

export const ProviderCredentialsSection = ({ providerId }: Props) => {
  const credentials = useAppStore((s) => s.providerCredentials);
  const createCredential = useAppStore((s) => s.createCredential);
  const deleteCredential = useAppStore((s) => s.deleteCredential);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const apiKeyEnv = PROVIDER_API_KEY_ENV[providerId];
  const reportError = useAppStore((s) => s.reportError);

  const mine = useMemo(
    () => credentials.filter((c) => c.providerId === providerId),
    [credentials, providerId],
  );

  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<CredentialId | null>(null);

  const reset = useCallback(() => {
    setIsAdding(false);
    setLabel('');
    setApiKey('');
    setSaveError(null);
  }, []);

  const onSave = useCallback(async () => {
    if (apiKey.trim() === '') {
      return;
    }
    setIsBusy(true);
    setSaveError(null);
    try {
      await createCredential(providerId, label, apiKey);
      await refreshProviders();
      reset();
    } catch (err) {
      setSaveError(`Couldn't save the API key. ${formatError(err)}`);
    } finally {
      setIsBusy(false);
    }
  }, [apiKey, label, providerId, createCredential, refreshProviders, reset]);

  const onDelete = useCallback(
    async (credentialId: CredentialId) => {
      try {
        await deleteCredential(credentialId);
        await refreshProviders();
      } catch (err) {
        void reportError({
          recovery: CHECK_STATE,
          title: "Couldn't remove the API key",
          error: err,
        });
      } finally {
        setArmedId(null);
      }
    },
    [deleteCredential, refreshProviders, reportError],
  );

  if (apiKeyEnv === undefined) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader
        label="API keys"
        hint={`Add one or more ${apiKeyEnv} keys, then assign one to a workspace.`}
        action={
          isAdding ? null : (
            <Button size="sm" variant="quiet" onClick={() => setIsAdding(true)}>
              <Plus size={ICON_SIZE.row} aria-hidden />
              Add key
            </Button>
          )
        }
      />

      {mine.length === 0 && !isAdding ? (
        <EmptyState
          size="section"
          icon={CONCEPT_ICONS.providers}
          tone={CONCEPT_TONE.providers}
          title="No API keys yet"
        />
      ) : null}

      {mine.length > 0 && (
        <ul className="flex flex-col gap-2">
          {mine.map((c) => (
            <li
              key={c.id}
              className="group flex items-center gap-3 rounded-lg border border-border-soft bg-elevated p-3 transition-colors hover:border-border"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-fill text-muted-foreground"
                aria-hidden
              >
                <KeyRound size={ICON_SIZE.control} />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-row text-foreground">{c.label}</span>
                <span className="font-mono text-meta text-faint-foreground">{c.hint}</span>
              </div>
              <div className="flex-1" />
              <ConfirmPopover
                role="danger"
                icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
                title={`Remove "${c.label}"?`}
                description="Deletes this API key from Goodboy. A key a workspace still uses is kept."
                confirmLabel={`Remove ${c.label}`}
                isOpen={armedId === c.id}
                onConfirm={() => onDelete(c.id)}
                onCancel={() => setArmedId(null)}
                trigger={() => (
                  <IconButton
                    icon={Trash2}
                    label={`Remove ${c.label}`}
                    onClick={() => setArmedId(c.id)}
                  />
                )}
              />
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
        <div className="flex flex-col gap-2">
          <Input
            autoFocus
            aria-label="Key label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. work, personal)"
          />
          <Input
            type="password"
            aria-label={`${apiKeyEnv} value`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`${apiKeyEnv} value`}
          />
          <FormActions error={saveError}>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={isBusy}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void onSave()}
              isBusy={isBusy}
              busyLabel="Validating"
              disabled={apiKey.trim() === ''}
            >
              {saveError === null ? 'Save key' : 'Retry'}
            </Button>
          </FormActions>
        </div>
      ) : null}
    </section>
  );
};
