import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Check, Loader2, Pencil } from 'lucide-react';
import { Button, Textarea, cn } from '@goodboy/ui';
import { PlannerClient, type PlannerOutput, defaultsForRole } from '@goodboy/core';
import type {
  AgentEffort,
  AgentRole,
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
  ROLE_LABEL,
  ROLE_TO_KIND,
} from '../../../../features/session/agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { StepRowCompact } from '../StepRowCompact';
import {
  type EffortLevel,
  modelEffortLevels,
} from '../../../../features/chat/utils/chat-constants';
import { type VerbosityLevel } from '../../../../features/settings/verbosity';
import { InlineField } from '../../../../features/session/components/InlineField';
import { ModelSelect } from '../../../../features/session/components/ModelSelect';
import { EffortSelect } from '../../../../features/session/components/EffortSelect';
import { VerbositySelect } from '../../../../features/session/components/VerbositySelect';

type StepOverrides = {
  readonly model: string;
  readonly effort: EffortLevel;
  readonly verbosity: VerbosityLevel;
};

type Props = {
  workspaceId: WorkspaceId;
  providerId: ProviderId;
  initialProcess: string;
  saveAsPreset?: boolean;
  onWorkflowReady: (workflowId: WorkflowId) => void;
  onPlanChange?: (hasPlan: boolean) => void;
};

const DEFAULT_VERBOSITY: VerbosityLevel = 'normal';

export const WorkflowPlanner = ({
  workspaceId,
  providerId,
  initialProcess,
  saveAsPreset = false,
  onWorkflowReady,
  onPlanChange,
}: Props) => {
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate);
  const [processText, setProcessText] = useState(initialProcess);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PlannerOutput | null>(null);
  const [overrides, setOverrides] = useState<Record<number, StepOverrides>>({});
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const updateOverride = (index: number, patch: Partial<StepOverrides>) => {
    setOverrides((prev) => {
      const current = prev[index];
      if (!current) {
        return prev;
      }
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
    if (processText.trim().length === 0) {
      return;
    }
    setError(null);
    setPlan(null);
    setOverrides({});
    setEditing(false);
    setBusy(true);
    try {
      const client = new PlannerClient({ providerId, invokeFn: invoke });
      const result = await client.plan({ process: processText.trim() });
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
    if (!plan) {
      return;
    }
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
          role: s.role as AgentRole,
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
        isPreset: saveAsPreset,
        createdAt: now,
        updatedAt: now,
      };
      await savePhaseTemplate(workflow);
      onWorkflowReady(workflowId);
      setPlan(null);
      onPlanChange?.(false);
      setOverrides({});
      setProcessText('');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const planning = busy && !plan;
  const planButtonLabel = plan ? 'Re-plan' : 'Generate plan';

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg bg-subtle/80 ring-1 ring-border-soft transition-shadow focus-within:ring-foreground/15">
        <div className="relative">
          <Textarea
            value={processText}
            onChange={(e) => setProcessText(e.target.value)}
            placeholder="describe the process you expect (e.g. read the existing github integration, study how it works, then plan the gitlab equivalent, then implement)…"
            autoGrow
            minRows={5}
            maxRows={10}
            className="min-h-24 resize-none border-0 bg-transparent px-4 pt-3 pb-12 text-sm shadow-none focus-visible:ring-0"
          />
          <div className="absolute bottom-2.5 right-2.5">
            <Button
              size="sm"
              onClick={onPlan}
              disabled={busy || processText.trim().length === 0}
              className="min-w-[6.5rem]"
            >
              {planning ? (
                <Loader2 size={15} className="animate-spin" aria-label="planning" />
              ) : (
                planButtonLabel
              )}
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
        <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle p-3.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">{plan.workflowName}</div>
              {plan.reasoning ? (
                <p className="mt-0.5 line-clamp-2 text-2xs leading-relaxed text-muted-foreground">
                  {plan.reasoning}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              aria-pressed={editing}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-medium transition-colors',
                editing
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border-soft text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {editing ? (
                <>
                  <Check size={11} aria-hidden /> Done
                </>
              ) : (
                <>
                  <Pencil size={11} aria-hidden /> Edit
                </>
              )}
            </button>
          </div>

          <ol className="flex flex-col">
            {plan.steps.map((s, i) => {
              const ov = overrides[i];
              return editing ? (
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
              ) : (
                <li
                  key={`${i}-${s.name}`}
                  className="border-t border-border-soft/50 pt-2.5 first:border-t-0 first:pt-0"
                >
                  <StepRowCompact
                    index={i}
                    kind={ROLE_TO_KIND[s.role as AgentRole] ?? inferAgentKindFromName(s.name)}
                    name={s.name}
                    model={ov?.model ?? defaultsForRole(s.role).model}
                    verbosity={ov?.verbosity ?? DEFAULT_VERBOSITY}
                  />
                </li>
              );
            })}
          </ol>
          <Button size="sm" onClick={onSave} disabled={busy} className="w-full">
            {busy ? (
              <Loader2 size={15} className="animate-spin" aria-label="saving" />
            ) : (
              'Use this workflow'
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

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
  const kind = ROLE_TO_KIND[role as AgentRole] ?? inferAgentKindFromName(name);
  const pal = AGENT_KIND_PALETTE[kind];
  const roleLabel = ROLE_LABEL[role as AgentRole] ?? role;

  return (
    <li className="flex flex-col gap-2 border-t border-border-soft/50 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        <span className="w-3 shrink-0 text-right font-mono text-2xs text-muted-foreground/40">
          {index + 1}
        </span>
        <AgentAvatar kind={kind} size="xs" />
        <span className={cn('min-w-0 flex-1 truncate text-xs font-semibold', pal.fg)}>{name}</span>
        <span
          className={cn(
            'shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            pal.fg,
          )}
        >
          {roleLabel}
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
