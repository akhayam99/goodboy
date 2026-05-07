import { useEffect, useState } from 'react';
import { Button, Dialog, Input, Textarea, cn } from '@kay-am/ui';
import type { ProviderId, SessionId, SessionProviderPreference, WorkspaceId } from '@kay-am/types';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../settings';
import { useAppStore } from '../store';

interface NewSessionDialogProps {
  open: boolean;
  onClose: () => void;
  workspaceId: WorkspaceId;
  onOpenSettings: () => void;
}

const PROVIDER_ORDER: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];

const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: 'claude',
  cursor: 'cursor',
  codex: 'codex',
};

function pickDefaultProvider(connectedIds: ReadonlySet<ProviderId>): ProviderId {
  for (const id of PROVIDER_ORDER) {
    if (connectedIds.has(id)) return id;
  }
  return 'anthropic';
}

export function NewSessionDialog({
  open,
  onClose,
  workspaceId,
  onOpenSettings,
}: NewSessionDialogProps) {
  const createSession = useAppStore((s) => s.createSession);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const providers = useAppStore((s) => s.providers);
  const settingKey = settingBranchPrefix(workspaceId);
  const storedPrefix = useAppStore((s) => s.settings[settingKey]);
  const [goal, setGoal] = useState('');
  const [prefix, setPrefix] = useState(storedPrefix ?? DEFAULT_BRANCH_PREFIX);
  const [softCapRaw, setSoftCapRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(() => {
    const ids = new Set(providers.filter((p) => p.connection === 'connected').map((p) => p.id));
    return pickDefaultProvider(ids);
  });

  useEffect(() => {
    if (!open) return;
    void loadSetting(settingKey).then((value) => {
      setPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
    const ids = new Set(providers.filter((p) => p.connection === 'connected').map((p) => p.id));
    setSelectedProvider(pickDefaultProvider(ids));
  }, [open, settingKey, loadSetting, providers]);

  const reset = () => {
    setGoal('');
    setPrefix(storedPrefix ?? DEFAULT_BRANCH_PREFIX);
    setSoftCapRaw('');
    setError(null);
  };

  const onCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      const providerPreference: SessionProviderPreference = {
        defaultProvider: selectedProvider,
        allowTurnOverride: true,
      };
      const { session } = await createSession({
        workspaceId,
        goal,
        branchPrefix: prefix,
        providerPreference,
      });
      const parsedCap = parseFloat(softCapRaw);
      if (softCapRaw.trim().length > 0 && !isNaN(parsedCap) && parsedCap > 0) {
        await setSessionBudget(session.id as SessionId, parsedCap);
      }
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const connectedProviderIds = new Set(
    providers.filter((p) => p.connection === 'connected').map((p) => p.id),
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="new session"
      description="creates a worktree on a fresh branch from the workspace root."
      size="md"
      footer={
        <>
          {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
          <Button variant="ghost" onClick={onClose}>
            cancel
          </Button>
          <Button onClick={onCreate} disabled={goal.trim().length === 0 || busy}>
            {busy ? 'creating…' : 'create session'}
          </Button>
        </>
      }
    >
      <Field label="goal" hint="what the session should accomplish.">
        <Textarea
          value={goal}
          placeholder="refactor auth domain"
          onChange={(e) => setGoal(e.target.value)}
        />
      </Field>

      <Field label="branch prefix" hint="branch name will be `<prefix>/<slug>`.">
        <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="kay" />
      </Field>

      <Field label="soft cap (usd)" hint="optional spend limit. session is flagged when exceeded.">
        <Input
          value={softCapRaw}
          onChange={(e) => setSoftCapRaw(e.target.value)}
          placeholder="e.g. 5.00"
          type="number"
          min="0"
          step="0.01"
        />
      </Field>

      <Field label="provider">
        <ul className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-md border border-border">
          {PROVIDER_ORDER.map((id) => {
            const connected = connectedProviderIds.has(id);
            const disabled = !connected;
            const selected = selectedProvider === id;
            return (
              <li
                key={id}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  disabled ? 'opacity-50' : 'hover:bg-muted/40',
                  selected && !disabled ? 'bg-muted/60' : '',
                )}
              >
                <input
                  type="radio"
                  name="provider"
                  id={`provider-${id}`}
                  value={id}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => setSelectedProvider(id)}
                  className="accent-primary"
                />
                <label
                  htmlFor={`provider-${id}`}
                  className={cn(
                    'flex flex-1 items-center justify-between',
                    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                  )}
                >
                  <span className="font-medium">{PROVIDER_LABEL[id]}</span>
                  {!connected && (
                    <button
                      type="button"
                      className="text-[11px] text-primary underline hover:opacity-80"
                      onClick={() => {
                        onClose();
                        onOpenSettings();
                      }}
                    >
                      connect in settings
                    </button>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </Field>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
