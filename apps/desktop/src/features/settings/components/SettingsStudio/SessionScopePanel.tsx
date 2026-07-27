import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { FieldRow, Input, ScrollFade, cn } from '@goodboy/ui';
import type { ProviderId, SessionId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore, useSessionById } from '../../../../store';
import { SESSION_FEATURES } from '../../../../shared/lib/features';
import { parseCap } from '../../../../shared/lib/parse-cap';
import { useToast } from '../../../../app/components/Toast';
import { PROVIDER_LABEL } from '../../../../features/chat/utils/chat-constants';
import { ProviderChip } from '../../../../features/providers/components/ProviderChip';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionScopePanel = ({ sessionId }: Props) => {
  const session = useSessionById(sessionId);
  const budget = useAppStore((s) => s.sessionBudgets[sessionId] ?? null);
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const loadSessionBudget = useAppStore((s) => s.loadSessionBudget);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const setSessionConfig = useAppStore((s) => s.setSessionConfig);
  const connectedProviderIds = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );
  const { showToast } = useToast();

  const [capDraft, setCapDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadSessionBudget(sessionId);
  }, [sessionId, loadSessionBudget]);

  useEffect(() => {
    setCapDraft(budget?.softCapUsd != null ? String(budget.softCapUsd) : '');
  }, [budget?.softCapUsd]);

  if (!session) {
    return null;
  }

  const isActiveSession = sessionSummary !== null;
  const spent = isActiveSession ? (sessionSummary?.estimatedCostUsd ?? 0) : 0;
  const currentProvider = session.providerPreference.defaultProvider;

  const commitCap = async () => {
    const savedCap = budget?.softCapUsd != null ? String(budget.softCapUsd) : '';
    if (capDraft.trim() === savedCap) {
      return;
    }
    const parsed = parseCap(capDraft);
    if (parsed === null) {
      setError('Cap must be a positive number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setSessionBudget(sessionId, parsed);
      showToast('success', 'budget cap saved');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const onChangeProvider = async (next: ProviderId) => {
    if (next === session.providerPreference.defaultProvider) {
      return;
    }
    if (!connectedProviderIds.includes(next)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setSessionConfig(sessionId, { defaultProvider: next });
      showToast('success', `default provider set to ${PROVIDER_LABEL[next] ?? next}`);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const onToggleEnabledProvider = async (next: ProviderId) => {
    const pref = session.providerPreference;
    if (next === pref.defaultProvider) {
      return;
    }
    const effective = new Set<ProviderId>(pref.enabledProviders ?? connectedProviderIds);
    if (effective.has(next)) {
      effective.delete(next);
    } else {
      effective.add(next);
    }
    effective.add(pref.defaultProvider);
    const selected = connectedProviderIds.filter((p) => effective.has(p));
    const allEnabled = selected.length === connectedProviderIds.length;
    setBusy(true);
    setError(null);
    try {
      await setSessionConfig(sessionId, { enabledProviders: allEnabled ? null : selected });
      showToast('success', 'routing providers updated');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollFade className="h-full w-full" viewportClassName="px-5 py-5">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <div className="flex flex-col divide-y divide-border-soft/50">
          <FieldRow label="Default provider" help="Runs new agents and workflow steps.">
            <div className="flex max-w-64 flex-wrap justify-end gap-1">
              {SESSION_PROVIDER_OPTIONS.map((id) => (
                <ProviderChip
                  key={id}
                  id={id}
                  selected={currentProvider === id}
                  disabled={busy || !connectedProviderIds.includes(id)}
                  onClick={() => void onChangeProvider(id)}
                  trailing={
                    connectedProviderIds.includes(id) ? null : (
                      <span className="text-2xs uppercase tracking-wide text-warning">offline</span>
                    )
                  }
                />
              ))}
            </div>
          </FieldRow>

          <FieldRow
            label="Routing pool"
            help="Starts from the workspace pool. Providers Goodboy can pick on its own, like when drafting a workflow. Unselected ones still appear in the step and chat pickers."
          >
            {connectedProviderIds.length === 0 ? (
              <span className="text-2xs text-muted-foreground">No providers connected.</span>
            ) : (
              <div className="flex max-w-64 flex-wrap justify-end gap-1">
                {connectedProviderIds.map((id) => {
                  const enabled = (
                    session.providerPreference.enabledProviders ?? connectedProviderIds
                  ).includes(id);
                  const isDefault = id === currentProvider;
                  return (
                    <ProviderChip
                      key={id}
                      id={id}
                      selected={enabled}
                      disabled={busy || isDefault}
                      onClick={() => void onToggleEnabledProvider(id)}
                      title={isDefault ? 'default provider is always enabled' : undefined}
                      trailing={
                        isDefault ? (
                          <span className="text-2xs uppercase tracking-wide text-muted-foreground/70">
                            default
                          </span>
                        ) : null
                      }
                    />
                  );
                })}
              </div>
            )}
          </FieldRow>

          {SESSION_FEATURES.budget ? (
            <FieldRow
              label="Budget cap"
              help="Optional ceiling in USD. Warns at 80%, errors at 100%."
              layout="stacked"
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                value={capDraft}
                onChange={(e) => setCapDraft(e.target.value)}
                onBlur={() => void commitCap()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void commitCap();
                  }
                }}
                placeholder="2.50"
                disabled={busy}
                aria-label="budget cap in USD"
              />
              {budget?.softCapUsd != null && budget.softCapUsd > 0 ? (
                <CapProgress spent={spent} softCapUsd={budget.softCapUsd} />
              ) : null}
            </FieldRow>
          ) : null}
        </div>

        {error ? <p className="pt-4 text-xs text-danger">{error}</p> : null}
      </div>
    </ScrollFade>
  );
};

const SESSION_PROVIDER_OPTIONS: ReadonlyArray<ProviderId> = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
];

function CapProgress({ spent, softCapUsd }: { spent: number; softCapUsd: number }) {
  const pct = softCapUsd > 0 ? Math.min(1, spent / softCapUsd) : 0;
  const barTone =
    pct >= 1 ? 'bg-danger' : pct >= 0.8 ? 'bg-warning' : pct >= 0.5 ? 'bg-info' : 'bg-success';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Spent this session</span>
        <span className="font-mono tabular-nums text-foreground">
          ${spent.toFixed(2)} / ${softCapUsd.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn('h-full rounded-full motion-safe:transition-all', barTone)}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-2xs text-muted-foreground/70">
        <span className="tabular-nums">{Math.round(pct * 100)}% used</span>
        {pct >= 0.8 ? (
          <span className={pct >= 1 ? 'text-danger' : 'text-warning'}>
            {pct >= 1 ? 'cap exceeded' : 'approaching cap'}
          </span>
        ) : null}
      </div>
    </div>
  );
}
