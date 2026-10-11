import { useMemo, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { modelOnProvider, roleResolutionOf } from '../../../providers/roleResolution';
import type { ProviderId, SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { StepEditor } from '../StepTree/StepEditor';
import { usePolish } from '../../hooks/usePolish';
import { useProsePolishDeps } from '../../hooks/useProsePolishDeps';
import { stepPolishFields } from '../../stepPolishFields';
import { addStep, type StepDraft } from '../../engine';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly workflowRunId: WorkflowRunId;
  readonly stepCount: number;
  readonly isOrchestrating: boolean;
  readonly onClose: () => void;
};

const blankDraft = (): StepDraft => addStep({ steps: [] })[0]!;

export const RunStepDraft = ({
  sessionId,
  workspaceId,
  workflowRunId,
  stepCount,
  isOrchestrating,
  onClose,
}: Props) => {
  const addStepToWorkflowRun = useAppStore((state) => state.addStepToWorkflowRun);
  const workspaceRoleModels = useAppStore(
    (state) => state.workspaceOverrides?.[workspaceId]?.roleModels ?? null,
  );
  const sessionProvider = useAppStore((state) => {
    const session = sessionById(state.sessions, sessionId);
    if (session == null) {
      return null;
    }
    return (session.providerOverride ?? session.providerPreference.defaultProvider) as ProviderId;
  });
  const providers = useAppStore((state) => state.providers);
  const [draft, setDraft] = useState<StepDraft>(blankDraft);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectedProviders = useMemo(
    () =>
      (providers ?? [])
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
    [providers],
  );
  const polishDeps = useProsePolishDeps({ workspaceId, workingDir: null });
  const polish = usePolish({ onError: setError });

  const roleRouting = roleResolutionOf({ role: draft.role, roleModels: workspaceRoleModels });
  const defaultProvider: ProviderId =
    roleRouting.source !== 'auto'
      ? roleRouting.provider
      : (sessionProvider ?? connectedProviders[0] ?? 'anthropic');
  const resolvedProvider: ProviderId = draft.provider !== '' ? draft.provider : defaultProvider;
  const recommendedModel = modelOnProvider({
    role: draft.role,
    provider: resolvedProvider,
    roleModels: workspaceRoleModels,
  });
  const patch = (next: Partial<StepDraft>) => setDraft((current) => ({ ...current, ...next }));

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
      reason: formatError(reason),
    }));
    setIsBusy(false);
    if (outcome.kind === 'refused') {
      setError(outcome.reason);
      return;
    }
    onClose();
  };

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-border-soft bg-subtle pt-2">
      <StepEditor
        step={draft}
        ordinal={stepCount + 1}
        stepCount={stepCount + 1}
        effort={draft.effort}
        recommendedProvider={defaultProvider}
        recommendedModel={recommendedModel}
        connectedProviders={connectedProviders}
        isRoutingOverridden={draft.provider !== '' || draft.model !== ''}
        disabled={isBusy}
        polish={stepPolishFields({
          polish,
          deps: polishDeps,
          goal: '',
          step: draft,
          patchStep: (_key, next) => patch(next),
        })}
        estimateNote={
          error !== null
            ? null
            : isOrchestrating
              ? 'The orchestrator is choosing the next step'
              : null
        }
        doneLabel={isBusy ? 'Adding' : 'Add step'}
        isDoneDisabled={isBusy || isOrchestrating || draft.name.trim() === ''}
        onName={(value) => patch({ name: value })}
        onRole={(value) => patch({ role: value })}
        onPrompt={(value) => patch({ prompt: value })}
        onExpectedOutput={(value) => patch({ expectedOutput: value })}
        onRoute={patch}
        onVerbosity={(value) => patch({ verbosity: value })}
        onRoutingReset={() => patch({ provider: '', model: '' })}
        onPin={() => patch({ provider: resolvedProvider, model: recommendedModel })}
        deleteLabel="Discard step"
        onDelete={onClose}
        onDone={() => void submit()}
        onEscape={onClose}
      />
      {error === null ? null : (
        <p role="alert" className="px-3 pb-3 text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
