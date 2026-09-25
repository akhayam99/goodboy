import { PROVIDER_API_KEY_ENV } from '@goodboy/core';
import { useCallback, useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  InlineConfirm,
  Input,
  SectionHeader,
  Tooltip,
  cn,
  tintClasses,
} from '@goodboy/ui';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { type CredentialId, type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';

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
      void reportError({ title: "Couldn't save the API key", error: err });
    } finally {
      setBusy(false);
    }
  }, [apiKey, label, providerId, createCredential, refreshProviders, reset, reportError]);

  const onDelete = useCallback(
    async (credentialId: CredentialId) => {
      try {
        await deleteCredential(credentialId);
        await refreshProviders();
      } catch (err) {
        void reportError({ title: "Couldn't remove the API key", error: err });
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
        hint={`Add one or more ${apiKeyEnv} keys, then assign one to a workspace below.`}
        action={
          !adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
            >
              <Plus size={ICON_SIZE.row} aria-hidden /> Add key
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
          className="bg-subtle py-8"
        />
      ) : null}

      {mine.length > 0 && (
        <ul className="flex flex-col gap-2">
          {mine.map((c) =>
            armedId === c.id ? (
              <li key={c.id}>
                <InlineConfirm
                  role="danger"
                  icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
                  title={`Remove "${c.label}"?`}
                  description="Deletes this API key from Goodboy. A key a workspace still uses is kept."
                  confirmLabel={`Remove ${c.label}`}
                  autoDisarmMs={4000}
                  onConfirm={() => onDelete(c.id)}
                  onCancel={() => setArmedId(null)}
                />
              </li>
            ) : (
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
                  <span className="truncate text-sm font-medium text-foreground">{c.label}</span>
                  <span className="font-mono text-2xs text-faint-foreground">{c.hint}</span>
                </div>
                <div className="flex-1" />
                <Tooltip content={`Remove ${c.label}`}>
                  <button
                    type="button"
                    aria-label={`Remove ${c.label}`}
                    onClick={() => setArmedId(c.id)}
                    className={cn(
                      'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity',
                      tintClasses('danger').hoverBg,
                      'hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group-hover:opacity-100',
                    )}
                  >
                    <Trash2 size={ICON_SIZE.row} aria-hidden />
                  </button>
                </Tooltip>
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
