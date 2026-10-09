import { Eyebrow } from '@goodboy/ui';
import type {
  Agent,
  EffortLevel,
  ProviderId,
  SessionId,
  Step,
  WorkflowModelPick,
} from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { agentPlace } from '../../../../store/slices/navigation/place';
import { selectWorkflowNodeRouting } from '../../../../store/slices/workflowRouting/selectWorkflowNodeRouting';
import { workflowNodeRoutingKey } from '../../../../store/slices/workflowRouting/workflowNodeRoutingKey';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { WORKFLOW_ROUTING_COPY } from '../../workflowRoutingCopy';
import { lockableEffort } from './lockableEffort';

type LockParams = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
};

type Props = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly step: Step | null;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
};

export const WorkflowNodeRoutingRow = ({ sessionId, agent, step, connectedProviders }: Props) => {
  const key = workflowNodeRoutingKey({ nodeKind: 'agent', id: agent.id });
  const isPending = useAppStore((state) => state.workflowNodeRoutingPending[key] ?? false);
  const error = useAppStore((state) => state.workflowNodeRoutingErrors[key] ?? null);
  const setWorkflowNodeRoutingLock = useAppStore((state) => state.setWorkflowNodeRoutingLock);
  const resetWorkflowNodeRoutingLock = useAppStore((state) => state.resetWorkflowNodeRoutingLock);
  const navigate = useAppStore((state) => state.navigate);
  const view = selectWorkflowNodeRouting({ agent, step, isPending, error });
  const shown = view.executed ?? view.selected;
  const effort: EffortLevel = shown?.effort ?? 'medium';
  const automatic = view.proposal?.pick ?? (view.isLocked ? null : view.selected);
  const automaticReason = view.proposal?.reason ?? (view.isLocked ? '' : view.reason);

  const lock = ({ provider, model, effort: next }: LockParams) => {
    const pick: WorkflowModelPick = {
      provider,
      model,
      effort: lockableEffort({ provider, model, effort: next }),
    };
    void setWorkflowNodeRoutingLock({ sessionId, nodeKind: 'agent', id: agent.id, pick });
  };

  const reset = () => {
    void resetWorkflowNodeRoutingLock({ sessionId, nodeKind: 'agent', id: agent.id });
  };

  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-md border border-border-soft bg-background px-2 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: agentPlace({ sessionId, agentId: agent.id }) })}
          className="min-w-0 flex-1 truncate text-left text-chip text-foreground transition-colors hover:text-primary"
        >
          {agent.name}
        </button>
        <Eyebrow label={view.sourceLabel} muted className="shrink-0" />
      </div>
      {view.isMutable ? (
        <RoutingPicker
          ariaLabel={`Routing for ${agent.name}`}
          connectedProviders={connectedProviders}
          provider={view.isLocked ? (shown?.provider ?? '') : ''}
          model={view.isLocked ? (shown?.model ?? '') : ''}
          effort={{ editable: true, value: effort }}
          recommendation={{
            ...(automatic != null && { provider: automatic.provider, model: automatic.model }),
            ...(automatic?.effort != null && { effort: automatic.effort }),
            ...(automaticReason !== '' && { reason: automaticReason }),
          }}
          recommendationKind="auto"
          disabled={isPending}
          overridden={view.isLocked}
          onReset={reset}
          resetLabel={
            view.isLegacy
              ? WORKFLOW_ROUTING_COPY.legacyResetLabel
              : WORKFLOW_ROUTING_COPY.resetLabel
          }
          onChange={(route) => {
            if (route.provider === '') {
              reset();
              return;
            }
            lock({ provider: route.provider, model: route.model, effort: route.effort });
          }}
        />
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <RoutingLabel
            provider={shown?.provider ?? null}
            model={shown?.model ?? null}
            effort={shown?.effort ?? null}
          />
          <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">
            {WORKFLOW_ROUTING_COPY.immutableNote}
          </span>
        </div>
      )}
      {view.difficultyLabel != null || view.reason !== '' ? (
        <p className="text-meta leading-relaxed text-muted-foreground">
          {view.difficultyLabel != null ? `${view.difficultyLabel}. ` : ''}
          {view.reason}
        </p>
      ) : null}
      {view.error != null ? (
        <p role="alert" className="text-meta leading-relaxed text-danger">
          {view.error}
        </p>
      ) : null}
    </li>
  );
};
