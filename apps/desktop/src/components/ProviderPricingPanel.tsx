import { useState } from 'react';
import { Button, Input } from '@kay-am/ui';
import type { ProviderPricingConfig } from '../providerPricing';
import { CODEX_CHEAP_MODEL } from '@kay-am/core';

const CODEX_MODELS = ['codex-latest', CODEX_CHEAP_MODEL] as const;

interface ProviderPricingPanelProps {
  config: ProviderPricingConfig;
  onChange: (next: ProviderPricingConfig) => void;
}

interface ModelFields {
  inputPerMtok: string;
  outputPerMtok: string;
  cachedInputPerMtok: string;
}

function emptyFields(): ModelFields {
  return { inputPerMtok: '', outputPerMtok: '', cachedInputPerMtok: '' };
}

function configToFields(config: ProviderPricingConfig): Record<string, ModelFields> {
  const result: Record<string, ModelFields> = {};
  for (const model of CODEX_MODELS) {
    const entry = config.codex?.[model];
    result[model] = entry
      ? {
          inputPerMtok: String(entry.inputPerMtok),
          outputPerMtok: String(entry.outputPerMtok),
          cachedInputPerMtok:
            entry.cachedInputPerMtok != null ? String(entry.cachedInputPerMtok) : '',
        }
      : emptyFields();
  }
  return result;
}

export function ProviderPricingPanel({ config, onChange }: ProviderPricingPanelProps) {
  const [fields, setFields] = useState<Record<string, ModelFields>>(() => configToFields(config));

  const updateField = (model: string, key: keyof ModelFields, value: string) => {
    const next = { ...fields, [model]: { ...fields[model]!, [key]: value } };
    setFields(next);

    const codex: Record<
      string,
      { inputPerMtok: number; outputPerMtok: number; cachedInputPerMtok?: number }
    > = {};
    for (const m of CODEX_MODELS) {
      const f = next[m]!;
      const input = parseFloat(f.inputPerMtok);
      const output = parseFloat(f.outputPerMtok);
      if (isFinite(input) && input >= 0 && isFinite(output) && output >= 0) {
        const cached = parseFloat(f.cachedInputPerMtok);
        codex[m] = {
          inputPerMtok: input,
          outputPerMtok: output,
          ...(isFinite(cached) && cached >= 0 ? { cachedInputPerMtok: cached } : {}),
        };
      }
    }
    onChange({ ...config, codex: Object.keys(codex).length > 0 ? codex : undefined });
  };

  const clearModel = (model: string) => {
    const next = { ...fields, [model]: emptyFields() };
    setFields(next);
    const codex = { ...config.codex };
    delete codex[model];
    onChange({ ...config, codex: Object.keys(codex).length > 0 ? codex : undefined });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-foreground">provider pricing override</span>
        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
          codex only
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        codex CLI does not report token counts. set prices (USD per 1M tokens) to enable cost
        tracking. leave blank to treat codex as unmetered.
      </p>
      <div className="flex flex-col gap-3">
        {CODEX_MODELS.map((model) => (
          <ModelRow
            key={model}
            model={model}
            fields={fields[model] ?? emptyFields()}
            onUpdate={(key, value) => updateField(model, key, value)}
            onClear={() => clearModel(model)}
          />
        ))}
      </div>
    </div>
  );
}

function ModelRow({
  model,
  fields,
  onUpdate,
  onClear,
}: {
  model: string;
  fields: ModelFields;
  onUpdate: (key: keyof ModelFields, value: string) => void;
  onClear: () => void;
}) {
  const hasAny = fields.inputPerMtok !== '' || fields.outputPerMtok !== '';
  return (
    <div className="rounded border border-border-soft p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-foreground">{model}</span>
        {hasAny ? (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-5 px-2 text-[10px]">
            clear
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <PriceField
          label="input $/Mtok"
          value={fields.inputPerMtok}
          onChange={(v) => onUpdate('inputPerMtok', v)}
        />
        <PriceField
          label="output $/Mtok"
          value={fields.outputPerMtok}
          onChange={(v) => onUpdate('outputPerMtok', v)}
        />
        <PriceField
          label="cached $/Mtok"
          value={fields.cachedInputPerMtok}
          onChange={(v) => onUpdate('cachedInputPerMtok', v)}
        />
      </div>
    </div>
  );
}

function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-muted-foreground">{label}</label>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="h-7 text-xs"
      />
    </div>
  );
}
