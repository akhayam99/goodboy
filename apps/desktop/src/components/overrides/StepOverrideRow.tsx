import { cn } from '@kay-am/ui';
import type { AgentEffort } from '@kay-am/types';
import { VERBOSITY_LEVELS, type VerbosityLevel } from '../../features/settings/verbosity';
import { EFFORT_TEXT, VERBOSITY_TEXT, modelLabel } from '../chat/chat-constants';

const STEP_SELECTABLE_MODELS = [
  'claude-haiku-4-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-6',
  'claude-opus-4-7',
] as const;

export interface StepOverrideValues {
  readonly model: string;
  readonly effort: AgentEffort;
  readonly verbosity: VerbosityLevel;
}

interface StepOverrideRowProps {
  readonly values: StepOverrideValues;
  readonly onChange: (next: StepOverrideValues) => void;
}

const EFFORT_SEGMENT: ReadonlyArray<AgentEffort> = ['low', 'medium', 'high', 'extra-high', 'max'];

const EFFORT_SHORT: Record<AgentEffort, string> = {
  low: 'low',
  medium: 'med',
  high: 'high',
  'extra-high': 'x-hi',
  max: 'max',
};

const VERBOSITY_SHORT: Record<VerbosityLevel, string> = {
  brief: 'brf',
  normal: 'norm',
  verbose: 'verb',
};

export function StepOverrideRow({ values, onChange }: StepOverrideRowProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <OverrideGroup label="model">
        <select
          value={values.model}
          onChange={(e) => onChange({ ...values, model: e.target.value })}
          className={cn(
            'rounded border border-border-soft bg-background px-1.5 py-0.5 text-2xs text-foreground',
            'focus:outline-none focus:ring-1 focus:ring-primary/60',
          )}
        >
          {STEP_SELECTABLE_MODELS.map((m) => (
            <option key={m} value={m}>
              {modelLabel(m)}
            </option>
          ))}
        </select>
      </OverrideGroup>

      <OverrideGroup label="effort">
        <SegmentedControl<AgentEffort>
          options={EFFORT_SEGMENT}
          value={values.effort}
          getLabel={(v) => EFFORT_SHORT[v]}
          getActiveClass={(v) => EFFORT_TEXT[v]}
          onChange={(v) => onChange({ ...values, effort: v })}
        />
      </OverrideGroup>

      <OverrideGroup label="verbosity">
        <SegmentedControl<VerbosityLevel>
          options={[...VERBOSITY_LEVELS]}
          value={values.verbosity}
          getLabel={(v) => VERBOSITY_SHORT[v]}
          getActiveClass={(v) => VERBOSITY_TEXT[v]}
          onChange={(v) => onChange({ ...values, verbosity: v })}
        />
      </OverrideGroup>
    </div>
  );
}

function OverrideGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-2xs text-muted-foreground/70">{label}</span>
      {children}
    </span>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  getLabel,
  getActiveClass,
  onChange,
}: {
  options: ReadonlyArray<T>;
  value: T;
  getLabel: (v: T) => string;
  getActiveClass: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <span className="inline-flex rounded border border-border-soft bg-subtle">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            title={`${opt}`}
            className={cn(
              'px-1.5 py-0.5 text-2xs transition-colors first:rounded-l last:rounded-r',
              active
                ? cn('bg-background font-semibold shadow-sm', getActiveClass(opt))
                : 'text-muted-foreground/60 hover:text-foreground',
            )}
          >
            {getLabel(opt)}
          </button>
        );
      })}
    </span>
  );
}
