import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, GhostActionButton } from '@goodboy/ui';
import { recommendedModelForRole, resolveRoleRouting } from '@goodboy/core';
import type { ProviderId, SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { WorkflowStepCard } from '../../../session/components/WorkflowStepCard';
import { kindForRole } from '../../../session/agent-kind';
import { mergeRoleModels } from '../../mergeRoleModels';
import { addStep, stepDraftWithModel, type StepDraft } from '../../engine';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly workflowRunId: WorkflowRunId;
  readonly stepCount: number;
};

const blankDraft = (): StepDraft => addStep({ steps: [] })[0]!;

export const WorkflowAddStep = ({ sessionId, workspaceId, workflowRunId, stepCount }: Props) => {
  const addStepToWorkflowRun = useAppStore((state) => state.addStepToWorkflowRun);
  const workspaceRoleModels = useAppStore(
    (state) => state.workspaceOverrides?.[workspaceId]?.roleModels ?? null,
  );
  const runRoleModels = useAppStore(
    (state) =>
      state.sessions
        .find((candidate) => candidate.id === sessionId)
        ?.workflowRuns.find((candidate) => candidate.id === workflowRunId)?.roleModelOverrides ??
      null,
  );
  const sessionProvider = useAppStore((state) => {
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (session == null) {
      return null;
    }
    return (session.providerOverride ?? session.providerPreference.defaultProvider) as ProviderId;
  });
  const isOrchestrating = useAppStore(
    (state) => state.orchestratingWorkflowRuns?.[workflowRunId] === true,
  );
  const providers = useAppStore((state) => state.providers);
  const [draft, setDraft] = useState<StepDraft | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectedProviders = (providers ?? [])
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id);
  const roleModels = mergeRoleModels({ workspace: workspaceRoleModels, run: runRoleModels });

  if (draft === null) {
    return (
      <GhostActionButton
        icon={Plus}
        label="Add step"
        title={
          isOrchestrating
            ? 'The orchestrator is choosing the next step'
            : 'Append one more agent to this run'
        }
        disabled={isOrchestrating}
        onClick={() => {
          setError(null);
          setDraft(blankDraft());
        }}
      />
    );
  }

  const roleRouting = resolveRoleRouting({ role: draft.role, prefs: roleModels });
  const defaultProvider: ProviderId = roleRouting.isOverride
    ? roleRouting.provider
    : (sessionProvider ?? connectedProviders[0] ?? 'anthropic');
  const resolvedProvider: ProviderId = draft.provider !== '' ? draft.provider : defaultProvider;
  const recommendedModel = recommendedModelForRole({
    role: draft.role,
    provider: resolvedProvider,
    prefs: roleModels,
  });
  const patch = (next: Partial<StepDraft>) =>
    setDraft((current) => (current === null ? current : { ...current, ...next }));

  const submit = async () => {
    setIsBusy(true);
    setError(null);
    const outcome = await addStepToWorkflowRun({
      sessionId,
      workflowRunId,
      name: draft.name,
      role: draft.role,
      promptPrefix: draft.prompt,
      ...(draft.expectedOutput.trim() !== '' && { expectedOutput: draft.expectedOutput }),
      ...(draft.provider !== '' && { providerOverride: draft.provider }),
      ...(draft.model.trim() !== '' && { modelOverride: draft.model }),
      effort: draft.effort,
      verbosity: draft.verbosity,
    }).catch((reason: unknown) => ({
      kind: 'refused' as const,
      reason: reason instanceof Error ? reason.message : String(reason),
    }));
    setIsBusy(false);
    if (outcome.kind === 'refused') {
      setError(outcome.reason);
      return;
    }
    setDraft(null);
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <ul className="flex list-none flex-col p-0">
        <WorkflowStepCard
          ordinal={stepCount}
          kind={kindForRole({ role: draft.role })}
          role={draft.role}
          provider={resolvedProvider}
          providerValue={draft.provider}
          recommendedProvider={defaultProvider}
          connectedProviders={connectedProviders}
          name={draft.name}
          promptPrefix={draft.prompt}
          expectedOutput={draft.expectedOutput}
          model={draft.model}
          resolvedModel={draft.model !== '' ? draft.model : recommendedModel}
          recommendedModel={recommendedModel}
          effort={draft.effort}
          verbosity={draft.verbosity}
          expanded
          dragging={false}
          disabled={isBusy}
          polishing={false}
          onExpand={() => undefined}
          onCollapse={() => undefined}
          onStartDrag={() => undefined}
          onName={(value) => patch({ name: value })}
          onPrompt={(value) => patch({ prompt: value })}
          onExpectedOutput={(value) => patch({ expectedOutput: value })}
          onProvider={(value) => patch({ provider: value })}
          onModel={(value) =>
            patch(
              stepDraftWithModel({
                step: draft,
                provider: draft.provider,
                model: value,
                recommendedModel,
              }),
            )
          }
          onEffort={(value) => patch({ effort: value })}
          onVerbosity={(value) => patch({ verbosity: value })}
          onRole={(value) => patch({ role: value })}
          isRoutingOverridden={draft.provider !== '' || draft.model !== ''}
          onRoutingReset={() => patch({ provider: '', model: '' })}
          onRemove={() => setDraft(null)}
          onMoveUp={() => undefined}
          onMoveDown={() => undefined}
        />
      </ul>
      {error !== null ? (
        <span className="text-2xs font-medium text-danger" role="alert">
          {error}
        </span>
      ) : null}
      {error === null && isOrchestrating ? (
        <span className="text-2xs font-medium text-muted-foreground">
          the orchestrator is choosing the next step
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={isBusy || isOrchestrating || draft.name.trim() === ''}
          onClick={() => void submit()}
        >
          {isBusy ? 'Adding' : 'Add step'}
        </Button>
        <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setDraft(null)}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
