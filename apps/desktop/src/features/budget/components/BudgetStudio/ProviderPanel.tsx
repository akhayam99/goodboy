import { useMemo } from 'react';
import { StatCard, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { BudgetRule, ProviderName } from '@goodboy/types';
import type { ProviderSpendEntry } from '../../../../store';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import { CapEditor } from './CapEditor';
import { CostRing } from './CostRing';
import { ModelTable } from './ModelTable';
import { PanelShell } from './PanelShell';
import { TurnsTable } from './TurnsTable';
import { Widget } from './Widget';
import { buildModelBreakdown, providerLabel, type WorkspaceTurn } from './lib';

type Props = {
  readonly provider: ProviderName;
  readonly entry: ProviderSpendEntry | null;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly rule: BudgetRule | null;
  readonly onSaveCap: (capUsd: number) => Promise<void>;
  readonly onRemoveCap: () => Promise<void>;
};

export const ProviderPanel = ({ provider, entry, turns, rule, onSaveCap, onRemoveCap }: Props) => {
  const spent = entry?.spentUsd ?? 0;
  const capUsd = entry?.capUsd ?? null;
  const pct = entry?.pct ?? 0;
  const remaining = capUsd !== null ? Math.max(capUsd - spent, 0) : null;

  const filtered = useMemo(
    () => turns.filter((t) => t.record.provider === provider),
    [turns, provider],
  );
  const models = useMemo(() => buildModelBreakdown(filtered.map((t) => t.record)), [filtered]);

  return (
    <PanelShell
      icon={
        <span className="flex size-11 shrink-0 items-center justify-center">
          <ProviderIcon provider={provider} size={26} withChip />
        </span>
      }
      title={providerLabel(provider)}
      subtitle={`${formatUsdPrecise(spent)} total spend`}
    >
      {capUsd !== null ? (
        <section className="flex items-center gap-6 rounded-lg border border-border-soft bg-muted/20 p-5">
          <CostRing pct={pct} centerLabel={`${Math.round(pct * 100)}%`} subLabel="of cap" />
          <div className="grid flex-1 grid-cols-3 gap-3">
            <StatCard label="spent" value={formatUsdPrecise(spent)} />
            <StatCard label="cap" value={formatUsd(capUsd)} />
            <StatCard label="remaining" value={formatUsd(remaining ?? 0)} />
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-3 gap-3">
          <StatCard label="spent" value={formatUsdPrecise(spent)} />
          <StatCard label="turns" value={String(filtered.length)} />
          <StatCard label="models" value={String(models.length)} />
        </section>
      )}

      <CapEditor
        label="monthly cap"
        hint="cap monthly spend for this provider"
        currentCapUsd={rule?.capUsd ?? null}
        onSave={onSaveCap}
        onRemove={onRemoveCap}
      />

      <Widget label="by model">
        <ModelTable entries={models} showProvider={false} />
      </Widget>

      <TurnsTable turns={filtered} showProvider={false} showSession />
    </PanelShell>
  );
};
