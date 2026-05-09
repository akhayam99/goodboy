import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button, Textarea, cn } from '@kay-am/ui';
import { PlannerClient, type PlannerOutput } from '@kay-am/core';
import type { ProviderId, Step, StepId, Workflow, WorkflowId, WorkspaceId } from '@kay-am/types';
import { useAppStore } from '../store';

interface PlannerWidgetProps {
  workspaceId: WorkspaceId;
  providerId: ProviderId;
  initialTheme: string;
  onWorkflowReady: (workflowId: WorkflowId) => void;
}

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
  const [error, setError] = useState<string | null>(null);

  const onPlan = async () => {
    if (theme.trim().length === 0) return;
    setError(null);
    setPlan(null);
    setBusy(true);
    try {
      const client = new PlannerClient({ providerId, invokeFn: invoke });
      const result = await client.plan({ theme: theme.trim() });
      setPlan(result.output);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      const steps: ReadonlyArray<Step> = plan.steps.map((s, ordinal) => ({
        id: `step_planner_${crypto.randomUUID()}` as StepId,
        workflowId,
        ordinal,
        name: s.name,
        promptPrefix: s.promptPrefix,
      }));
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
      setTheme('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md bg-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">design with planner</span>
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
          {busy && !plan ? 'planning…' : plan ? 're-plan' : 'generate plan'}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      {plan ? (
        <div className="flex flex-col gap-2 rounded-md bg-background p-3">
          <div>
            <div className="text-sm font-semibold">{plan.workflowName}</div>
            {plan.reasoning ? (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {plan.reasoning}
              </p>
            ) : null}
          </div>
          <ol className="flex flex-col gap-1.5">
            {plan.steps.map((s, i) => (
              <li key={`${i}-${s.name}`} className={cn('rounded-md bg-subtle px-2.5 py-1.5')}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium">
                    {i + 1}. {s.name}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
                    {s.role}
                  </span>
                </div>
                <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                  {s.expectedOutput}
                </p>
              </li>
            ))}
          </ol>
          <Button size="sm" onClick={onSave} disabled={busy}>
            {busy ? 'saving…' : 'use this workflow'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
