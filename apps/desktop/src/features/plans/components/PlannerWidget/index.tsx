import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button, Textarea, cn } from '@goodboy/ui';
import { PlannerClient, type PlannerOutput, defaultsForRole } from '@goodboy/core';
import type {
  AgentEffort,
  ProviderId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';
import {
  AGENT_KIND_PALETTE,
  inferAgentKindFromName,
} from '../../../../features/session/agent-kind';
import {
  type EffortLevel,
  type VerbosityLevel,
  modelEffortLevels,
  InlineField,
  ModelSelect,
  EffortSelect,
  VerbositySelect,
} from '../../../../features/session/components/config-selects';

interface StepOverrides {
  readonly model: string;
  readonly effort: EffortLevel;
  readonly verbosity: VerbosityLevel;
}

interface PlannerWidgetProps {
  workspaceId: WorkspaceId;
  providerId: ProviderId;
  initialTheme: string;
  onWorkflowReady: (workflowId: WorkflowId) => void;
  onPlanChange?: (hasPlan: boolean) => void;
}

const DEFAULT_VERBOSITY: VerbosityLevel = 'normal';

export function PlannerWidget({
  workspaceId,
  providerId,
  initialTheme,
  onWorkflowReady,
  onPlanChange,
}: PlannerWidgetProps) {
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate);
  const [theme, setTheme] = useState(initialTheme);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PlannerOutput | null>(null);
  const [overrides, setOverrides] = useState<Record<number, StepOverrides>>({});
  const [error, setError] = useState<string | null>(null);

  const updateOverride = (index: number, patch: Partial<StepOverrides>) => {
    setOverrides((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const next = { ...current, ...patch };
      if (patch.model) {
        const levels = modelEffortLevels(patch.model);
        if (levels && !levels.includes(next.effort)) {
          next.effort = levels[0]!;
        }
      }
      return { ...prev, [index]: next };
    });
  };

  const onPlan = async () => {
    if (theme.trim().length === 0) return;
    setError(null);
    setPlan(null);
    setOverrides({});
    setBusy(true);
    try {
      const client = new PlannerClient({ providerId, invokeFn: invoke });
      const result = await client.plan({ theme: theme.trim() });
      setPlan(result.output);
      onPlanChange?.(true);
      const initial: Record<number, StepOverrides> = {};
      result.output.steps.forEach((s, i) => {
        const d = defaultsForRole(s.role);
        initial[i] = {
          model: d.model,
          effort: d.effort as EffortLevel,
          verbosity: DEFAULT_VERBOSITY,
        };
      });
      setOverrides(initial);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const now = new Date().toISOString() as Workflow['createdAt'];
      const workflowId = `wf_planner_${crypto.randomUUID()}` as WorkflowId;
      const steps: ReadonlyArray<Step> = plan.steps.map((s, ordinal) => {
        const o = overrides[ordinal] ?? {
          ...defaultsForRole(s.role),
          verbosity: DEFAULT_VERBOSITY,
        };
        return {
          id: `step_planner_${crypto.randomUUID()}` as StepId,
          workflowId,
          ordinal,
          name: s.name,
          promptPrefix: s.promptPrefix,
          modelOverride: o.model,
          effort: o.effort as AgentEffort,
          verbosity: o.verbosity as VerbosityLevel,
        };
      });
      const workflow: Workflow = {
        id: workflowId,
        workspaceId,
        name: plan.workflowName,
        description: plan.reasoning,
        steps,
        createdAt: now,
        updatedAt: now,
      };
      await savePhaseTemplate(workflow);
      onWorkflowReady(workflowId);
      setPlan(null);
      onPlanChange?.(false);
      setOverrides({});
      setTheme('');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const planButtonLabel = (() => {
    if (busy && !plan) return 'Planning…';
    if (plan) return 'Re-plan';
    return 'Generate plan';
  })();

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-2xl bg-subtle/80 ring-1 ring-border-soft transition-shadow focus-within:ring-foreground/15">
        <div className="relative">
          <Textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="describe the theme: e.g. migrate auth to oauth, add dark mode toggle…"
            autoGrow
            minRows={5}
            maxRows={10}
            className="min-h-24 resize-none border-0 bg-transparent px-4 pt-3 pb-12 text-sm shadow-none focus-visible:ring-0"
          />
          <div className="absolute bottom-2.5 right-2.5">
            <Button size="sm" onClick={onPlan} disabled={busy || theme.trim().length === 0}>
              {planButtonLabel}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex justify-end px-1">
        <span className="text-2xs text-muted-foreground/60">cheap-tier · {providerId}</span>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      {plan ? (
        <div className="flex flex-col gap-3 rounded-md border border-border-soft bg-background p-3">
          <div>
            <div className="text-sm font-semibold">{plan.workflowName}</div>
            {plan.reasoning ? (
              <p className="mt-0.5 line-clamp-2 text-2xs leading-relaxed text-muted-foreground">
                {plan.reasoning}
              </p>
            ) : null}
          </div>
          <ol className="flex flex-col gap-2">
            {plan.steps.map((s, i) => {
              const ov = overrides[i];
              return (
                <StepCard
                  key={`${i}-${s.name}`}
                  index={i}
                  name={s.name}
                  role={s.role}
                  description={s.expectedOutput}
                  overrides={ov ?? null}
                  provider={providerId}
                  onChange={(patch) => updateOverride(i, patch)}
                />
              );
            })}
          </ol>
          <Button size="sm" onClick={onSave} disabled={busy}>
            {busy ? 'Saving…' : 'Use this workflow'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StepCard({
  index,
  name,
  role,
  description,
  overrides,
  provider,
  onChange,
}: {
  index: number;
  name: string;
  role: string;
  description: string;
  overrides: StepOverrides | null;
  provider: ProviderId;
  onChange: (patch: Partial<StepOverrides>) => void;
}) {
  const kindBg = AGENT_KIND_PALETTE[inferAgentKindFromName(name)].bg;

  return (
    <li className="flex flex-col gap-2 rounded-md bg-subtle px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {index + 1}
        </span>
        <span className={cn('size-2 shrink-0 rounded-full', kindBg)} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
          {name}
        </span>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {role}
        </span>
      </div>
      {description ? (
        <p className="line-clamp-1 text-2xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {overrides ? (
        <div className="grid grid-cols-3 gap-2">
          <InlineField label="Model">
            <ModelSelect
              provider={provider}
              value={overrides.model}
              onChange={(model) => onChange({ model })}
              disabled={false}
            />
          </InlineField>
          <InlineField label="Effort">
            <EffortSelect
              model={overrides.model}
              value={overrides.effort}
              onChange={(effort) => onChange({ effort })}
              disabled={false}
            />
          </InlineField>
          <InlineField label="Verbosity">
            <VerbositySelect
              value={overrides.verbosity}
              onChange={(verbosity) => onChange({ verbosity })}
              disabled={false}
            />
          </InlineField>
        </div>
      ) : null}
    </li>
  );
}
