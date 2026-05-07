import { useEffect, useState } from 'react';
import { Button, Dialog, Input, Textarea, cn } from '@kay-am/ui';
import type { ProviderId, SessionProviderPreference, WorkspaceId } from '@kay-am/types';
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
  const providers = useAppStore((s) => s.providers);
  const settingKey = settingBranchPrefix(workspaceId);
  const storedPrefix = useAppStore((s) => s.settings[settingKey]);
  const [goal, setGoal] = useState('');
  const [prefix, setPrefix] = useState(storedPrefix ?? DEFAULT_BRANCH_PREFIX);
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
      await createSession({ workspaceId, goal, branchPrefix: prefix, providerPreference });
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
    <Dialog open={open} onClose={onClose} title="new session">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          goal
          <Textarea
            value={goal}
            placeholder="refactor auth domain"
            onChange={(e) => setGoal(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          branch prefix
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="kay" />
        </label>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          provider
          <ul className="flex flex-col divide-y divide-border rounded border border-border">
            {PROVIDER_ORDER.map((id) => {
              const connected = connectedProviderIds.has(id);
              const disabled = !connected;
              return (
                <li
                  key={id}
                  className={cn('flex items-center gap-2 px-3 py-2', disabled ? 'opacity-50' : '')}
                >
                  <input
                    type="radio"
                    name="provider"
                    id={`provider-${id}`}
                    value={id}
                    checked={selectedProvider === id}
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
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={onCreate} disabled={goal.trim().length === 0 || busy}>
          {busy ? 'creating…' : 'create'}
        </Button>
      </div>
    </Dialog>
  );
}
