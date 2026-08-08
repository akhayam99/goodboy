import { useCallback, useMemo, useState } from 'react';
import { Button, EmptyState, InlineConfirm, Input, SectionHeader } from '@goodboy/ui';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { PROVIDER_API_KEY_ENV, type CredentialId, type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';
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
  const { showToast } = useToast();

  const mine = useMemo(
    () => credentials.filter((c) => c.providerId === providerId),
    [credentials, providerId],
  );

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [armedId, setArmedId] = useState<CredentialId | null>(null);

  const reset = useCallback(() => {
    setAdding(false);
    setLabel('');
    setApiKey('');
  }, []);

  const onSave = useCallback(async () => {
    if (!apiKey.trim()) {
      return;
    }
    setBusy(true);
    try {
      await createCredential(providerId, label, apiKey);
      await refreshProviders();
      reset();
    } catch (err) {
      showToast('error', formatError(err));
    } finally {
      setBusy(false);
    }
  }, [apiKey, label, providerId, createCredential, refreshProviders, reset, showToast]);

  const onDelete = useCallback(
    async (credentialId: CredentialId) => {
      await deleteCredential(credentialId);
      await refreshProviders();
      setArmedId(null);
    },
    [deleteCredential, refreshProviders],
  );

  if (apiKeyEnv === undefined) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader
        label="API keys"
        hint={`Add one or more ${apiKeyEnv} keys, then assign one to a workspace below.`}
        action={
          !adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus size={12} aria-hidden /> Add key
            </button>
          ) : null
        }
      />

      {mine.length === 0 && !adding ? (
        <EmptyState
          bordered
          icon={CONCEPT_ICONS.providers}
          tone={CONCEPT_TONE.providers}
          title="No API keys yet"
          size="inline"
          className="bg-muted/10 py-8"
        />
      ) : null}

      {mine.length > 0 && (
        <ul className="flex flex-col gap-2">
          {mine.map((c) =>
            armedId === c.id ? (
              <li key={c.id}>
                <InlineConfirm
                  role="danger"
                  icon={<Trash2 size={12} aria-hidden />}
                  title={`Remove "${c.label}"?`}
                  description="Deletes this API key from Goodboy. You can add it again later."
                  confirmLabel={`Remove ${c.label}`}
                  autoDisarmMs={4000}
                  onConfirm={() => onDelete(c.id)}
                  onCancel={() => setArmedId(null)}
                />
              </li>
            ) : (
              <li
                key={c.id}
                className="group flex items-center gap-3 rounded-lg border border-border-soft bg-muted/20 p-3 transition-colors hover:bg-muted/30"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                  aria-hidden
                >
                  <KeyRound size={14} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{c.label}</span>
                  <span className="font-mono text-2xs text-muted-foreground/70">{c.hint}</span>
                </div>
                <div className="flex-1" />
                <button
                  type="button"
                  aria-label={`Remove ${c.label}`}
                  onClick={() => setArmedId(c.id)}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] group-hover:opacity-100"
                >
                  <Trash2 size={13} aria-hidden />
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {adding ? (
        <div className="flex flex-col gap-2">
          <Input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. work, personal)"
          />
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`${apiKeyEnv} value`}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void onSave()}
              disabled={busy || !apiKey.trim()}
              className={busy ? 'animate-border-pulse' : undefined}
            >
              {busy ? 'Validating' : 'Save key'}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
};
