import { useEffect, useRef } from 'react';
import type {
  Agent,
  ModelEffort,
  ProviderId,
  SessionId,
  Step,
  WorkflowModelPick,
} from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { selectWorkflowNodeRouting } from '../../../../store/slices/workflowRouting/selectWorkflowNodeRouting';
import { workflowNodeRoutingKey } from '../../../../store/slices/workflowRouting/workflowNodeRoutingKey';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import type { EffortLevel } from '../../../chat/utils/chat-constants';
import { WORKFLOW_ROUTING_COPY } from '../../workflowRoutingCopy';
import { lockableEffort } from './lockableEffort';

type LockParams = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: ModelEffort;
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
  const selectAgent = useAppStore((state) => state.selectAgent);
  const view = selectWorkflowNodeRouting({ agent, step, isPending, error });
  const shown = view.executed ?? view.selected;
  const draftRef = useRef<WorkflowModelPick | null>(null);
  const pendingProviderRef = useRef<ProviderId | null>(null);
  const effort: EffortLevel = shown?.effort ?? 'medium';
  const automatic = view.proposal?.pick ?? (view.isLocked ? null : view.selected);
  const automaticReason = view.proposal?.reason ?? (view.isLocked ? '' : view.reason);

  useEffect(() => {
    draftRef.current = null;
    pendingProviderRef.current = null;
  }, [shown?.provider, shown?.model, shown?.effort, view.isLocked]);

  const lock = ({ provider, model, effort: next }: LockParams) => {
    const pick: WorkflowModelPick = {
      provider,
      model,
      effort: lockableEffort({ provider, model, effort: next }),
    };
    draftRef.current = pick;
    pendingProviderRef.current = null;
    void setWorkflowNodeRoutingLock({ sessionId, nodeKind: 'agent', id: agent.id, pick });
  };

  const reset = () => {
    draftRef.current = null;
    pendingProviderRef.current = null;
    void resetWorkflowNodeRoutingLock({ sessionId, nodeKind: 'agent', id: agent.id });
  };

  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border-soft bg-background/40 px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void selectAgent(sessionId, agent.id)}
          className="min-w-0 flex-1 truncate text-left text-2xs font-medium text-foreground transition-colors hover:text-primary"
        >
          {agent.name}
        </button>
        <span className="shrink-0 text-3xs font-medium uppercase tracking-wide text-muted-foreground/70">
          {view.sourceLabel}
        </span>
      </div>
      {view.isMutable ? (
        <RoutingPicker
          ariaLabel={`Routing for ${agent.name}`}
          connectedProviders={connectedProviders}
          provider={view.isLocked ? (shown?.provider ?? '') : ''}
          model={view.isLocked ? (shown?.model ?? '') : ''}
          effort={{
            editable: true,
            value: effort,
            onChange: (next) => {
              const current = draftRef.current ?? shown;
              if (current == null || current.effort === next) {
                return;
              }
              lock({ provider: current.provider, model: current.model, effort: next });
            },
          }}
          recommendation={{
            ...(automatic != null && { provider: automatic.provider, model: automatic.model }),
            ...(automatic?.effort != null && { effort: automatic.effort }),
            ...(automaticReason !== '' && { reason: automaticReason }),
          }}
          disabled={isPending}
          overridden={view.isLocked}
          onReset={reset}
          resetLabel={
            view.isLegacy
              ? WORKFLOW_ROUTING_COPY.legacyResetLabel
              : WORKFLOW_ROUTING_COPY.resetLabel
          }
          onProvider={(next) => {
            if (next === '') {
              reset();
              return;
            }
            pendingProviderRef.current = next;
          }}
          onModel={(model) => {
            const current = draftRef.current ?? shown;
            const provider = pendingProviderRef.current ?? current?.provider ?? null;
            if (provider === null) {
              return;
            }
            lock({ provider, model, effort: current?.effort ?? effort });
          }}
        />
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <RoutingBadge
            variant="full"
            provider={shown?.provider ?? null}
            model={shown?.model ?? null}
            effort={shown?.effort ?? null}
            missingLabel={WORKFLOW_ROUTING_COPY.noSelection}
          />
          <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
            {WORKFLOW_ROUTING_COPY.immutableNote}
          </span>
        </div>
      )}
      {view.difficultyLabel != null || view.reason !== '' ? (
        <p className="text-2xs leading-relaxed text-muted-foreground">
          {view.difficultyLabel != null ? `${view.difficultyLabel}. ` : ''}
          {view.reason}
        </p>
      ) : null}
      {view.error != null ? (
        <p role="alert" className="text-2xs leading-relaxed text-danger">
          {view.error}
        </p>
      ) : null}
    </li>
  );
};
