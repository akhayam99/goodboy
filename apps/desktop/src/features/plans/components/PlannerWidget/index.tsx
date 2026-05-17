import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button, Textarea } from '@kay-am/ui';
import { PlannerClient, type PlannerOutput, defaultsForRole } from '@kay-am/core';
import type {
  AgentEffort,
  ProviderId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@kay-am/types';
import type { VerbosityLevel } from '../../../../features/settings/verbosity';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';
import {
  StepOverrideRow,
  type StepOverrideValues,
} from '../../../workflow/components/overrides/StepOverrideRow';

interface PlannerWidgetProps {
  workspaceId: WorkspaceId;
  providerId: ProviderId;
  initialTheme: string;
  onWorkflowReady: (workflowId: WorkflowId) => void;
}

const DEFAULT_VERBOSITY: VerbosityLevel = 'normal';

export function PlannerWidget({
  workspaceId,
  providerId,
  initialTheme,
  onWorkflowReady,
}: PlannerWidgetProps) {
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate);
  const [theme, setTheme] = useState(initialTheme);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PlannerOutput | null>(null);
  const [overrides, setOverrides] = useState<Record<number, StepOverrideValues>>({});
  const [error, setError] = useState<string | null>(null);

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
      const initial: Record<number, StepOverrideValues> = {};
      result.output.steps.forEach((s, i) => {
        const d = defaultsForRole(s.role);
        initial[i] = { model: d.model, effort: d.effort, verbosity: DEFAULT_VERBOSITY };
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
          verbosity: o.verbosity,
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
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs text-muted-foreground">cheap-tier · {providerId}</span>
      </div>
      <Textarea
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        placeholder="describe the theme: e.g. migrate auth to oauth, add dark mode toggle…"
        autoGrow
        maxRows={5}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs text-muted-foreground">
          planner returns a structured workflow you can review before saving.
        </p>
        <Button size="sm" onClick={onPlan} disabled={busy || theme.trim().length === 0}>
          {planButtonLabel}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      {plan ? (
        <div className="flex flex-col gap-2 rounded-md border border-border-soft bg-background p-3">
          <div>
            <div className="text-sm font-semibold">{plan.workflowName}</div>
            {plan.reasoning ? (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {plan.reasoning}
              </p>
            ) : null}
          </div>
          <ol className="flex flex-col gap-1.5">
            {plan.steps.map((s, i) => {
              const ov = overrides[i];
              return (
                <li key={`${i}-${s.name}`} className="rounded-md bg-subtle px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="pt-0.5 text-xs font-medium">
                      {i + 1}. {s.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
                      {s.role}
                    </span>
                  </div>
                  {s.expectedOutput ? (
                    <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                      {s.expectedOutput}
                    </p>
                  ) : null}
                  {ov ? (
                    <StepOverrideRow
                      values={ov}
                      onChange={(next) => setOverrides((prev) => ({ ...prev, [i]: next }))}
                    />
                  ) : null}
                </li>
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
