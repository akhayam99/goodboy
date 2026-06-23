import { useCallback, useMemo, useState } from 'react';
import { Button, Input, SectionHeader } from '@goodboy/ui';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { PROVIDER_API_KEY_ENV, type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly providerId: ProviderId;
};

export const ProviderCredentialsSection = ({ providerId }: Props) => {
  const credentials = useAppStore((s) => s.providerCredentials);
  const createCredential = useAppStore((s) => s.createCredential);
  const deleteCredential = useAppStore((s) => s.deleteCredential);

  const mine = useMemo(
    () => credentials.filter((c) => c.providerId === providerId),
    [credentials, providerId],
  );

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setAdding(false);
    setLabel('');
    setApiKey('');
    setError(null);
  }, []);

  const onSave = useCallback(async () => {
    if (!apiKey.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createCredential(providerId, label, apiKey);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [apiKey, label, providerId, createCredential, reset]);

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader
        label="API keys"
        hint={`Add one or more ${PROVIDER_API_KEY_ENV[providerId]} keys, then assign one to a workspace below to bill its runs to that key instead of the CLI login.`}
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

      {mine.length === 0 && !adding && (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border-soft bg-muted/10 px-6 py-8 text-center">
          <KeyRound size={18} className="text-muted-foreground/70" aria-hidden />
          <span className="text-2xs text-muted-foreground">No API keys yet</span>
        </div>
      )}

      {mine.length > 0 && (
        <ul className="flex flex-col gap-2">
          {mine.map((c) => (
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
                onClick={() => void deleteCredential(c.id)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
              >
                <Trash2 size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-muted/20 p-3">
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
            placeholder={`${PROVIDER_API_KEY_ENV[providerId]} value`}
          />
          {error ? <p className="text-2xs text-danger">{error}</p> : null}
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
