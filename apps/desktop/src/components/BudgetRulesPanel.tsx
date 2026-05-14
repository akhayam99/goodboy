import { useEffect, useState } from 'react';
import { Button, Input, Select } from '@kay-am/ui';
import type { BudgetRule, ProviderName } from '@kay-am/types';
import { formatError } from '../errors';
import { useAppStore } from '../store';

const PROVIDER_OPTIONS: ProviderName[] = ['anthropic', 'cursor', 'codex'];

const DEFAULT_THRESHOLD = 80;

interface FormState {
  provider: ProviderName;
  capUsd: string;
  alertThresholdPct: string;
  extraTokensBudget: string;
}

const emptyForm = (): FormState => ({
  provider: 'anthropic',
  capUsd: '',
  alertThresholdPct: String(DEFAULT_THRESHOLD),
  extraTokensBudget: '',
});

export function BudgetRulesPanel() {
  const budgetRules = useAppStore((s) => s.budgetRules);
  const loadBudgetRules = useAppStore((s) => s.loadBudgetRules);
  const saveBudgetRule = useAppStore((s) => s.saveBudgetRule);
  const deleteBudgetRule = useAppStore((s) => s.deleteBudgetRule);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void loadBudgetRules();
  }, [loadBudgetRules]);

  const onAdd = async () => {
    const cap = parseFloat(form.capUsd);
    const threshold = parseFloat(form.alertThresholdPct);
    const extraRaw = form.extraTokensBudget.trim();
    const extraTokens = extraRaw === '' ? null : parseFloat(extraRaw);

    if (!isFinite(cap) || cap <= 0) {
      setFormError('cap must be a positive number');
      return;
    }
    if (!isFinite(threshold) || threshold < 1 || threshold > 100) {
      setFormError('threshold must be between 1 and 100');
      return;
    }
    if (extraTokens !== null && (!isFinite(extraTokens) || extraTokens < 0)) {
      setFormError('extra-token budget must be empty or a non-negative integer');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await saveBudgetRule({
        provider: form.provider,
        period: 'monthly',
        capUsd: cap,
        alertThresholdPct: threshold,
        extraTokensBudget: extraTokens !== null ? Math.floor(extraTokens) : null,
      });
      setForm(emptyForm());
      setShowForm(false);
    } catch (err) {
      setFormError(formatError(err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    await deleteBudgetRule(id);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-foreground">Budget rules</div>
        {!showForm && (
          <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}>
            Add rule
          </Button>
        )}
      </div>

      {budgetRules.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground">
          No rules defined. Add one to cap monthly spend per provider.
        </p>
      )}

      {budgetRules.length > 0 && (
        <ul className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-md border border-border-soft bg-subtle shadow-sm">
          {budgetRules.map((rule) => (
            <BudgetRuleRow key={rule.id} rule={rule} onDelete={() => void onDelete(rule.id)} />
          ))}
        </ul>
      )}

      {showForm && (
        <AddRuleForm
          form={form}
          onChange={setForm}
          onSave={() => void onAdd()}
          onCancel={() => {
            setShowForm(false);
            setForm(emptyForm());
            setFormError(null);
          }}
          saving={saving}
          error={formError}
        />
      )}
    </div>
  );
}

function BudgetRuleRow({ rule, onDelete }: { rule: BudgetRule; onDelete: () => void }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-xs">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{rule.provider}</span>
        <span className="text-xs text-muted-foreground">
          ${rule.capUsd.toFixed(2)} / month · alert at {rule.alertThresholdPct}%
          {rule.extraTokensBudget != null
            ? ` · ${rule.extraTokensBudget.toLocaleString()} extra tokens`
            : ''}
        </span>
      </div>
      <button
        type="button"
        className="shrink-0 text-xs text-muted-foreground underline hover:text-danger"
        onClick={onDelete}
      >
        delete
      </button>
    </li>
  );
}

function AddRuleForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
}: {
  form: FormState;
  onChange: (f: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border-soft bg-subtle p-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">provider</label>
        <Select
          size="sm"
          block
          value={form.provider}
          onChange={(e) => onChange({ ...form, provider: e.target.value as ProviderName })}
        >
          {PROVIDER_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">monthly cap (USD)</label>
          <Input
            type="number"
            min="0.01"
            step="1"
            placeholder="50"
            value={form.capUsd}
            onChange={(e) => onChange({ ...form, capUsd: e.target.value })}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">alert threshold (%)</label>
          <Input
            type="number"
            min="1"
            max="100"
            step="1"
            placeholder={String(DEFAULT_THRESHOLD)}
            value={form.alertThresholdPct}
            onChange={(e) => onChange({ ...form, alertThresholdPct: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">
          extra-token budget <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          type="number"
          min="0"
          step="1000"
          placeholder="leave empty for no token cap"
          value={form.extraTokensBudget}
          onChange={(e) => onChange({ ...form, extraTokensBudget: e.target.value })}
        />
        <p className="text-2xs text-muted-foreground">
          additional token allowance per period. empty = no extra-token budget.
        </p>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
